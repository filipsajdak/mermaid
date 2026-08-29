#!/usr/bin/env python3
"""Convert the OMG BPMN 2.0 example corpus to bpmn-beta and measure coverage."""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

SRC = "/Users/filipsajdak/Downloads/2010-06-03"
OUT = "/tmp/omg-mmd"

def local(tag):
    return tag.split('}')[-1] if '}' in tag else tag

def deref(ref):
    """An IDREF may carry a namespace prefix (`tns:sellerProcess`); the id does not."""
    if not ref:
        return ref
    return ref.split(':')[-1]

# Visual BPMN elements: everything a diagram actually draws. Non-visual infrastructure
# (definitions, process, laneSet, extensionElements, documentation, *Ref, ...) is out of
# the denominator because it is not something a renderer can be asked to draw.
EVENTS = {
    'startEvent': 'start',
    'endEvent': 'end',
    'intermediateCatchEvent': 'intermediate',
    'intermediateThrowEvent': 'throw',
    'boundaryEvent': 'boundary',
}
TASKS = {
    'task': 'task',
    'userTask': 'user task',
    'serviceTask': 'service task',
    'sendTask': 'send task',
    'receiveTask': 'receive task',
    'manualTask': 'manual task',
    'scriptTask': 'script task',
    'businessRuleTask': 'rule task',
    'subProcess': 'subprocess',
    'transaction': 'subprocess',
    'adHocSubProcess': 'subprocess',
    'callActivity': 'call',
}
GATEWAYS = {
    'exclusiveGateway': 'xor',
    'parallelGateway': 'and',
    'inclusiveGateway': 'or',
    'eventBasedGateway': 'event-gateway',
    'complexGateway': 'complex',
}
ARTIFACTS = {
    'dataObjectReference': 'data',
    'dataObject': 'data',
    'dataStoreReference': 'data-store',
    'dataStore': 'data-store',
    'textAnnotation': 'note',
}
TRIGGERS = {
    'messageEventDefinition': 'message',
    'timerEventDefinition': 'timer',
    'errorEventDefinition': 'error',
    'escalationEventDefinition': 'escalation',
    'cancelEventDefinition': 'cancel',
    'compensateEventDefinition': 'compensation',
    'conditionalEventDefinition': 'conditional',
    'linkEventDefinition': 'link',
    'signalEventDefinition': 'signal',
    'terminateEventDefinition': 'terminate',
}
# Drawn, but nothing in bpmn-beta expresses them.
UNSUPPORTED = {
    'choreographyTask', 'subChoreography', 'callChoreography',
    'conversationNode', 'conversation', 'subConversation', 'callConversation',
    'conversationLink', 'participantAssociation',
    'association', 'dataInputAssociation', 'dataOutputAssociation',
    'dataInput', 'dataOutput', 'group',
    'complexBehaviorDefinition',
}
CONTAINERS = {'participant', 'lane'}
FLOWS = {'sequenceFlow', 'messageFlow'}

COUNTED = (set(EVENTS) | set(TASKS) | set(GATEWAYS) | set(ARTIFACTS)
           | UNSUPPORTED | CONTAINERS | FLOWS)
SUPPORTED = set(EVENTS) | set(TASKS) | set(GATEWAYS) | set(ARTIFACTS) | CONTAINERS | FLOWS

def ident(raw, used):
    name = re.sub(r'[^0-9A-Za-z_]', '_', raw or '')
    name = re.sub(r'_+', '_', name).strip('_')
    if not name or not re.match(r'^[A-Za-z_]', name):
        name = 'n_' + name
    name = name[:40]
    base, i = name, 2
    while name in used and used[name] != raw:
        name = f'{base}_{i}'
        i += 1
    used[name] = raw
    return name

def label(el, fallback):
    text = (el.get('name') or '').strip()
    if not text:
        text = (el.findtext('{*}text') or '').strip() if local(el.tag) == 'textAnnotation' else ''
    text = re.sub(r'\s+', ' ', text)
    text = text.replace('"', "'")
    return (text or fallback)[:60]

def trigger_of(el):
    for child in el:
        name = local(child.tag)
        if name in TRIGGERS:
            return TRIGGERS[name]
    return None

def convert(path):
    tree = ET.parse(path)
    root = tree.getroot()

    counts, unsupported_seen = {}, {}
    for el in root.iter():
        name = local(el.tag)
        if name in COUNTED:
            counts[name] = counts.get(name, 0) + 1
            if name in UNSUPPORTED:
                unsupported_seen[name] = unsupported_seen.get(name, 0) + 1

    used = {}
    idmap = {}          # xml id -> emitted identifier
    emitted = set()     # xml ids we actually drew
    lines = ['bpmn-beta LR']

    processes = {p.get('id'): p for p in root.iter() if local(p.tag) == 'process'}
    collaborations = [c for c in root.iter() if local(c.tag) == 'collaboration']

    def emit_node(el, indent):
        name = local(el.tag)
        xml_id = el.get('id')
        if not xml_id:
            return
        node_id = ident(xml_id, used)
        idmap[xml_id] = node_id
        pad = ' ' * indent
        if name in EVENTS:
            trig = trigger_of(el)
            keyword = EVENTS[name]
            head = f'{keyword} {trig}' if trig else keyword
            lines.append(f'{pad}{head} {node_id} "{label(el, keyword)}"')
        elif name in TASKS:
            lines.append(f'{pad}{TASKS[name]} {node_id} "{label(el, "activity")}"')
        elif name in GATEWAYS:
            lines.append(f'{pad}{GATEWAYS[name]} {node_id} "{label(el, "gateway")}"')
        elif name in ARTIFACTS:
            lines.append(f'{pad}{ARTIFACTS[name]} {node_id} "{label(el, name)}"')
        else:
            return
        emitted.add(xml_id)

    def flow_nodes(container):
        return [c for c in container if local(c.tag) in (set(EVENTS) | set(TASKS) | set(GATEWAYS) | set(ARTIFACTS))]

    def emit_process(proc, indent):
        nodes = flow_nodes(proc)
        boundaries = [n for n in nodes if local(n.tag) == 'boundaryEvent']
        by_host = {}
        for b in boundaries:
            by_host.setdefault(deref(b.get('attachedToRef')), []).append(b)

        lanes = [l for l in proc.iter() if local(l.tag) == 'lane']
        lane_of = {}
        for lane in lanes:
            for ref in lane:
                if local(ref.tag) == 'flowNodeRef' and (ref.text or '').strip():
                    lane_of[deref(ref.text.strip())] = lane

        drawn = set()
        for lane in lanes:
            lines.append(f'{" " * indent}lane "{label(lane, "Lane")}"')
            for n in nodes:
                if n in boundaries:
                    continue
                if lane_of.get(n.get('id')) is lane:
                    emit_node(n, indent + 2)
                    drawn.add(id(n))
                    for b in by_host.get(n.get('id'), []):
                        emit_node(b, indent + 4)
        loose = [n for n in nodes if id(n) not in drawn and n not in boundaries]
        if loose:
            if lanes:
                lines.append(f'{" " * indent}lane "Other"')
                step = indent + 2
            else:
                step = indent
            for n in loose:
                emit_node(n, step)
                for b in by_host.get(n.get('id'), []):
                    emit_node(b, step + 2)

    if collaborations:
        for collab in collaborations:
            for part in collab:
                if local(part.tag) != 'participant':
                    continue
                proc = processes.get(deref(part.get('processRef')))
                lines.append(f'  pool "{label(part, "Pool")}"')
                if proc is not None:
                    emit_process(proc, 4)
    else:
        for proc in processes.values():
            emit_process(proc, 2)

    # Flows, only where both endpoints were drawn.
    kept_flows = 0
    for el in root.iter():
        name = local(el.tag)
        if name not in FLOWS:
            continue
        src, tgt = deref(el.get('sourceRef')), deref(el.get('targetRef'))
        if src in emitted and tgt in emitted:
            arrow = '-.->' if name == 'messageFlow' else '-->'
            text = label(el, '')
            if text and name == 'sequenceFlow':
                lines.append(f'  {idmap[src]} -- {text} --> {idmap[tgt]}')
            else:
                lines.append(f'  {idmap[src]} {arrow} {idmap[tgt]}')
            kept_flows += 1

    total = sum(counts.get(k, 0) for k in COUNTED)
    supported_total = sum(counts.get(k, 0) for k in SUPPORTED)
    return {
        'file': os.path.relpath(path, SRC),
        'mmd': '\n'.join(lines),
        'counts': counts,
        'unsupported': unsupported_seen,
        'total_visual': total,
        'expressible': supported_total,
        'nodes_drawn': len(emitted),
        'flows_kept': kept_flows,
    }

def main():
    os.makedirs(OUT, exist_ok=True)
    results = []
    for dirpath, _, files in os.walk(SRC):
        for f in sorted(files):
            if not f.endswith('.bpmn'):
                continue
            path = os.path.join(dirpath, f)
            try:
                r = convert(path)
            except Exception as exc:  # noqa: BLE001
                results.append({'file': os.path.relpath(path, SRC), 'error': str(exc)})
                continue
            slug = re.sub(r'[^0-9A-Za-z]+', '-', r['file']).strip('-').lower()[:60]
            r['slug'] = slug
            with open(os.path.join(OUT, slug + '.mmd'), 'w') as fh:
                fh.write(r['mmd'] + '\n')
            results.append(r)
    with open(os.path.join(OUT, 'results.json'), 'w') as fh:
        json.dump(results, fh, indent=1)
    for r in results:
        if 'error' in r:
            print(f"ERROR {r['file']}: {r['error']}")
        else:
            pct = (100.0 * r['expressible'] / r['total_visual']) if r['total_visual'] else 0
            print(f"{r['slug']:<52} visual={r['total_visual']:>4} expressible={r['expressible']:>4} "
                  f"({pct:5.1f}%) drawn={r['nodes_drawn']:>3} flows={r['flows_kept']:>3} "
                  f"unsupported={sorted(r['unsupported'])}")

if __name__ == '__main__':
    main()

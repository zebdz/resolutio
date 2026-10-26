"""Independent v1 fixture calculator using Python's hashlib/hmac, never application code.
Fixtures contain only strings, integers and booleans; UTF-16 key sorting matches JCS.
Run from any directory to regenerate the adjacent checked-in JSON vectors.
"""
import hashlib
import hmac
import json
from pathlib import Path


def canonical(value):
    if isinstance(value, dict):
        return '{' + ','.join(canonical(k) + ':' + canonical(value[k]) for k in sorted(value, key=lambda k: k.encode('utf-16be'))) + '}'
    if isinstance(value, list):
        return '[' + ','.join(map(canonical, value)) + ']'
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def tree(leaves):
    level = sorted(leaves)
    paths = {leaf: [] for leaf in level}
    groups = [[leaf] for leaf in level]
    while len(level) > 1:
        nodes, next_groups = [], []
        for i in range(0, len(level), 2):
            if i + 1 == len(level):
                nodes.append(level[i]); next_groups.append(groups[i]); continue
            for leaf in groups[i]: paths[leaf].append({'hash': level[i+1], 'side': 'right'})
            for leaf in groups[i+1]: paths[leaf].append({'hash': level[i], 'side': 'left'})
            nodes.append(digest(b'\x01' + bytes.fromhex(level[i]) + bytes.fromhex(level[i+1])))
            next_groups.append(groups[i] + groups[i+1])
        level, groups = nodes, next_groups
    return {'root': level[0] if level else digest(b''), 'leaves': sorted(leaves), 'paths': paths}


secret = bytes(range(32)).hex()
preimages = []
for i in range(5):
    q, a = 'q1', f'a{i+1}'
    preimages.append({'pollId': 'poll1', 'questionId': q, 'answerId': a, 'userId': 'user1',
                      'weight': '1.234567', 'castAt': '2026-09-11T10:00:00.123Z',
                      'salt': hmac.new(bytes.fromhex(secret), (q + ':' + a).encode(), hashlib.sha256).hexdigest()})
leaves = [{'preimage': p, 'canonical': canonical(p), 'hash': digest(b'\x00' + canonical(p).encode())} for p in preimages]
vectors = {'secret': secret, 'leaves': leaves, 'trees': [tree([leaf['hash'] for leaf in leaves[:n]]) for n in range(6)]}
Path(__file__).with_name('crypto-v1.json').write_text(json.dumps(vectors, ensure_ascii=False, indent=2) + '\n')

# Complete independent fixture. Expected tallies are written explicitly, not built by app logic.
cast = '2026-09-11T10:00:00.123Z'
finished = '2026-09-11T11:00:00.000Z'
captured = '2026-09-11T11:05:00.000Z'
sealed = '2026-09-11T11:05:01.000Z'
answer = lambda i, order, archived=None: {'id': i, 'order': order, 'text': i.upper(), 'archivedAt': archived}
questions = [
    {'id': 'q2', 'order': 2, 'text': 'Second?', 'details': None, 'questionType': 'single-choice', 'archivedAt': None, 'answers': [answer('b1', 0)]},
    {'id': 'q0', 'order': 0, 'text': 'Archived?', 'details': None, 'questionType': 'single-choice', 'archivedAt': cast, 'answers': [answer('old', 0, cast)]},
    {'id': 'q1', 'order': 1, 'text': 'First?', 'details': 'Pick several', 'questionType': 'multiple-choice', 'archivedAt': None, 'answers': [answer('a2', 0), answer('a1', 0), answer('a9', 9, cast)]},
]
poll = {'id': 'poll1', 'title': 'Café', 'description': '**Decision**', 'pollType': 'ORGANIZATION', 'anonymous': True,
        'organizationId': 'org1', 'organizationName': 'Organization', 'boardId': None, 'boardName': None,
        'metadataCapturedAt': captured, 'startDate': '2026-09-10T00:00:00.000Z', 'endDate': finished,
        'finishedAt': finished, 'distributionType': 'OWNERSHIP_SIZE_WEIGHTED', 'propertyAggregation': 'RAW_SUM',
        'weightCriteria': None, 'propertyIds': ['property2', 'property1'], 'createdBy': 'admin',
        'createdAt': '2026-09-09T00:00:00.000Z', 'questions': questions,
        'attachments': [{'id': 'file2', 'fileName': 'appendix.pdf', 'size': 200, 'mimeType': 'application/pdf'},
                        {'id': 'file1', 'fileName': 'agenda.pdf', 'size': 100, 'mimeType': 'application/pdf'}]}
holding = {'propertyId': 'property1', 'propertyName': 'House', 'assetId': 'asset1', 'assetName': 'Flat', 'size': '80.123456', 'sizeUnit': 'SQUARE_METERS', 'share': '0.12345678'}
def participant(i, weight, willingness, phone, receipt):
    return {'userId': f'user{i}', 'lastName': f'Last{i}', 'firstName': f'First{i}', 'middleName': None, 'weight': weight,
            'snapshotAt': '2026-09-10T00:00:00.000Z', 'holdings': [holding] if i == 1 else [],
            'willingToSignProtocol': willingness, 'phoneNumber': phone, 'receiptSecret': receipt}
participants = [participant(3, '3.000000', True, '+70000000003', None),
                participant(2, '2.000001', False, '+70000000002', bytes(range(32,64)).hex()),
                participant(1, '1.234567', True, '+70000000001', secret)]
votes = [{'pollId': 'poll1', 'userId': u, 'questionId': q, 'answerId': a, 'weight': w, 'castAt': cast}
         for u, q, a, w in [('user1','q1','a1','1.234567'), ('user1','q1','a2','1.234567'), ('user1','q2','b1','1.234567'),
                             ('user2','q1','a1','2.000001'), ('user2','q2','b1','2.000001')]]
input_data = {'state': 'FINISHED', 'poll': poll, 'participants': participants, 'votes': list(reversed(votes))}
poll_section = json.loads(json.dumps(poll))
poll_section['questions'].sort(key=lambda q: (q['order'], q['id']))
for q in poll_section['questions']: q['answers'].sort(key=lambda a: (a['order'], a['id']))
poll_section['propertyIds'].sort()
poll_section['attachments'].sort(key=lambda a: a['id'])
register = [{k:v for k,v in p.items() if k not in ['receiptSecret', 'willingToSignProtocol', 'phoneNumber']} | {'voted': p['userId'] != 'user3'} for p in sorted(participants, key=lambda p:p['userId'])]
signers = [{k:p[k] for k in ['userId','lastName','firstName','middleName','willingToSignProtocol']} | {'phoneNumber': p['phoneNumber'] if p['willingToSignProtocol'] else None} for p in sorted(participants, key=lambda p:p['userId']) if p['userId'] != 'user3']
tallies = {'questions': [
    {'questionId':'q1','answers':[{'answerId':'a1','voteCount':2,'totalWeight':'3.234568'}, {'answerId':'a2','voteCount':1,'totalWeight':'1.234567'}], 'totalVotes':3,'totalWeight':'4.469135','participantWeight':'3.234568'},
    {'questionId':'q2','answers':[{'answerId':'b1','voteCount':2,'totalWeight':'3.234568'}], 'totalVotes':2,'totalWeight':'3.234568','participantWeight':'3.234568'}],
    'totalParticipants':3, 'totalParticipantWeight':'6.234568'}
sections = {name: canonical(value) for name,value in [('poll',poll_section),('tallies',tallies),('register',register),('signers',signers)]}
record_leaves = []
for vote in votes:
    p = next(p for p in participants if p['userId'] == vote['userId'])
    salt = hmac.new(bytes.fromhex(p['receiptSecret']), (vote['questionId'] + ':' + vote['answerId']).encode(), hashlib.sha256).hexdigest()
    preimage = vote | {'salt': salt}
    record_leaves.append({'preimage': preimage, 'hash': digest(b'\x00' + canonical(preimage).encode())})
record_leaves.sort(key=lambda l:l['hash'])
manifest = {'version':1,'algorithm':'sha256','pollId':'poll1','sealedAt':sealed,'sections':{name:{'hash':digest(data.encode())} for name,data in sections.items()} | {'votes':{'root': tree([leaf['hash'] for leaf in record_leaves])['root'],'leafCount':len(record_leaves)}}}
manifest_bytes = canonical(manifest)
expected = {'manifest':manifest_bytes, 'rootDigest':digest(manifest_bytes.encode()), 'sections':sections, 'votes':record_leaves}
receipt = {'version':1,'algorithm':'sha256','pollId':'poll1','userId':'user1','receiptSecret':secret,'pollTitle':'Café',
           'leaves':[leaf | {'questionText': next(q['text'] for q in questions if q['id']==leaf['preimage']['questionId']),
                             'answerText': next(a['text'] for q in questions for a in q['answers'] if a['id']==leaf['preimage']['answerId'])} for leaf in record_leaves if leaf['preimage']['userId']=='user1']}
Path(__file__).with_name('record-v1.json').write_text(json.dumps({'input':input_data,'sealedAt':sealed,'record':expected,'receipt':canonical(receipt)}, ensure_ascii=False, indent=2)+'\n')

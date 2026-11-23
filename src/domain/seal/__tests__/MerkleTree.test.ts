/** Independent trees pin sorted leaves, odd promotion and sibling direction for 0–5 ballots. */
import { expect, it } from 'vitest';
import vectors from './fixtures/crypto-v1.json';
import { MerkleTree } from '../MerkleTree';
import { Digest } from '../SealValues';

it('proves each included ballot without disclosing the others', () => {
  for (const vector of vectors.trees) {
    const tree = MerkleTree.build(
      [...vector.leaves].reverse().map(Digest.parse)
    );
    expect(tree.root).toBe(vector.root);
    expect(tree.leaves).toEqual(vector.leaves);

    for (const leaf of vector.leaves) {
      const path = tree.pathFor(Digest.parse(leaf));
      expect(path).toEqual((vector.paths as Record<string, unknown>)[leaf]);
      expect(MerkleTree.verifyPath(leaf, path, vector.root)).toBe(true);
    }
  }
});

it('rejects absent, duplicate, malformed or tampered commitments', () => {
  const tree = MerkleTree.build(vectors.trees[3].leaves.map(Digest.parse));
  expect(() => tree.pathFor(Digest.parse('00'.repeat(32)))).toThrow(
    'domain.seal.leafNotFound'
  );
  expect(() => MerkleTree.build([Digest.parse('bad')])).toThrow();
  expect(() => MerkleTree.build([tree.leaves[0], tree.leaves[0]])).toThrow();
  expect(MerkleTree.verifyPath('bad', [], 'bad')).toBe(false);
  const leaf = tree.leaves[0];
  expect(
    MerkleTree.verifyPath(leaf, tree.pathFor(leaf).slice(1), tree.root)
  ).toBe(false);
  expect(
    MerkleTree.verifyPath(
      leaf,
      [{ hash: '00'.repeat(32), side: 'right' }],
      tree.root
    )
  ).toBe(false);
  expect(
    MerkleTree.verifyPath(
      leaf,
      tree.pathFor(leaf).map((s) => ({ ...s, side: 'invalid' as any })),
      tree.root
    )
  ).toBe(false);
  tree.leaves[0] = Digest.parse('00'.repeat(32));
  expect(tree.leaves[0]).toBe(leaf);
});

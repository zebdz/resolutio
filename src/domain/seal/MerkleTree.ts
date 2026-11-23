/** Sorted, domain-separated Merkle commitments with odd-node promotion.
 * Paths disclose siblings only; private arrays never escape the tree. */
import { assertHash, hashNode, hashText } from './Hash';
import { requireSeal, SealDomainCodes, SealError } from './SealDomainCodes';
import { exactKeys } from './Validation';
import { Digest } from './SealValues';
export interface MerkleSibling {
  hash: Digest;
  side: 'left' | 'right';
}

export class MerkleTree {
  private constructor(private readonly levels: Digest[][]) {}

  static build(leaves: readonly Digest[]): MerkleTree {
    leaves.forEach(assertHash);
    requireSeal(new Set(leaves).size === leaves.length);
    const levels = [[...leaves].sort()];

    while (levels[levels.length - 1].length > 1) {
      const level = levels[levels.length - 1];
      const next: Digest[] = [];

      for (let i = 0; i < level.length; i += 2) {
        next.push(
          i + 1 < level.length ? hashNode(level[i], level[i + 1]) : level[i]
        );
      }

      levels.push(next);
    }

    return new MerkleTree(levels);
  }

  get root(): Digest {
    return this.levels[this.levels.length - 1][0] ?? hashText('');
  }
  get leaves(): Digest[] {
    return [...this.levels[0]];
  }

  pathFor(leaf: Digest): MerkleSibling[] {
    let index = this.levels[0].indexOf(leaf);
    requireSeal(index >= 0, SealDomainCodes.SEAL_LEAF_NOT_FOUND);
    const path: MerkleSibling[] = [];

    for (const level of this.levels.slice(0, -1)) {
      const sibling = index % 2 === 0 ? index + 1 : index - 1;

      if (sibling < level.length) {
        path.push({
          hash: level[sibling],
          side: index % 2 === 0 ? 'right' : 'left',
        });
      }

      index = Math.floor(index / 2);
    }

    return path;
  }

  static verifyPath(leaf: unknown, path: unknown, root: unknown): boolean {
    try {
      assertHash(leaf);
      assertHash(root);
      requireSeal(Array.isArray(path) && path.length <= 64);
      let current = leaf;

      for (const sibling of path) {
        exactKeys(sibling, ['hash', 'side']);
        assertHash(sibling.hash);
        requireSeal(sibling.side === 'left' || sibling.side === 'right');
        current =
          sibling.side === 'left'
            ? hashNode(sibling.hash, current)
            : hashNode(current, sibling.hash);
      }

      return current === root;
    } catch (error) {
      if (error instanceof SealError) {
        return false;
      }

      throw error;
    }
  }
}

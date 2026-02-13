'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { hierarchy, tree as d3Tree } from 'd3-hierarchy';
import { linkRadial } from 'd3-shape';
import { select } from 'd3-selection';
import type { OrganizationTreeNode } from '@/domain/organization/OrganizationRepository';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import { Heading } from '@/app/components/catalyst/heading';

interface OrgHierarchyTreeProps {
  tree: OrganizationTreeNode;
  currentOrgId: string;
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

function TreeDiagram({
  tree,
  currentOrgId,
}: {
  tree: OrganizationTreeNode;
  currentOrgId: string;
}) {
  const t = useTranslations('organization.detail');
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const zoomRef = useRef(1);
  const baseBoxRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const viewBoxStartRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const router = useRouter();

  const applyZoom = useCallback((level: number) => {
    if (!svgRef.current) {
      return;
    }

    const { w, h } = baseBoxRef.current;
    // Read current viewBox center to preserve pan offset
    const parts = svgRef.current
      .getAttribute('viewBox')
      ?.split(' ')
      .map(Number);
    const curVbX = parts?.[0] ?? baseBoxRef.current.x;
    const curVbY = parts?.[1] ?? baseBoxRef.current.y;
    const curVbW = parts?.[2] ?? w;
    const curVbH = parts?.[3] ?? h;
    const cx = curVbX + curVbW / 2;
    const cy = curVbY + curVbH / 2;
    const nw = w / level;
    const nh = h / level;
    svgRef.current.setAttribute(
      'viewBox',
      `${cx - nw / 2} ${cy - nh / 2} ${nw} ${nh}`
    );
  }, []);

  const updateZoom = useCallback(
    (level: number) => {
      zoomRef.current = level;
      setZoom(level);
      applyZoom(level);
    },
    [applyZoom]
  );

  const zoomIn = useCallback(() => {
    updateZoom(Math.min(ZOOM_MAX, zoomRef.current + ZOOM_STEP));
  }, [updateZoom]);

  const zoomOut = useCallback(() => {
    updateZoom(Math.max(ZOOM_MIN, zoomRef.current - ZOOM_STEP));
  }, [updateZoom]);

  const zoomReset = useCallback(() => {
    // Reset both zoom and pan to original view
    if (svgRef.current) {
      const { x, y, w, h } = baseBoxRef.current;
      svgRef.current.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    }

    zoomRef.current = 1;
    setZoom(1);
  }, []);

  // Scroll-wheel zoom
  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomIn, zoomOut]);

  // Pointer drag-to-pan (activates only after moving beyond threshold)
  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const DRAG_THRESHOLD = 4; // px — below this, treat as click
    let pointerDown = false;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, a')) {
        return;
      }

      pointerDown = true;
      isPanningRef.current = false;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      const parts = svgRef.current
        ?.getAttribute('viewBox')
        ?.split(' ')
        .map(Number);

      if (parts) {
        viewBoxStartRef.current = { x: parts[0], y: parts[1] };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown || !svgRef.current) {
        return;
      }

      const mx = e.clientX - panStartRef.current.x;
      const my = e.clientY - panStartRef.current.y;

      // Activate panning only after exceeding threshold
      if (!isPanningRef.current) {
        if (Math.abs(mx) < DRAG_THRESHOLD && Math.abs(my) < DRAG_THRESHOLD) {
          return;
        }

        isPanningRef.current = true;
        setIsPanning(true);
      }

      const parts = svgRef.current
        .getAttribute('viewBox')
        ?.split(' ')
        .map(Number);

      if (!parts) {
        return;
      }

      const vbW = parts[2];
      const vbH = parts[3];
      const scale_x = vbW / container.clientWidth;
      const scale_y = vbH / container.clientHeight;
      const dx = mx * scale_x;
      const dy = my * scale_y;
      svgRef.current.setAttribute(
        'viewBox',
        `${viewBoxStartRef.current.x - dx} ${viewBoxStartRef.current.y - dy} ${vbW} ${vbH}`
      );
    };

    const onPointerUp = () => {
      pointerDown = false;
      isPanningRef.current = false;
      setIsPanning(false);
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  // Render d3 tree
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const root = hierarchy(tree);
    const nodeCount = root.descendants().length;

    const radius = Math.max(150, Math.min(400, nodeCount * 40));
    const layout = d3Tree<OrganizationTreeNode>()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth || 1);

    layout(root);

    // Compute tight bounding box from actual node positions
    const PAD = 60;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const d of root.descendants()) {
      const angle = d.x! - Math.PI / 2;
      const r = d.y!;
      const px = r * Math.cos(angle);
      const py = r * Math.sin(angle);
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }

    const bx = minX - PAD;
    const by = minY - PAD;
    const bw = maxX - minX + PAD * 2;
    const bh = maxY - minY + PAD * 2;
    baseBoxRef.current = { x: bx, y: by, w: bw, h: bh };
    svg.attr('viewBox', `${bx} ${by} ${bw} ${bh}`);

    // Links
    const radialLink = linkRadial<unknown, { x: number; y: number }>()
      .angle((d) => d.x)
      .radius((d) => d.y);

    svg
      .append('g')
      .attr('fill', 'none')
      .attr('stroke', '#a1a1aa')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', (d) =>
        radialLink({
          source: { x: d.source.x!, y: d.source.y! },
          target: { x: d.target.x!, y: d.target.y! },
        })
      );

    // Nodes
    const node = svg
      .append('g')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', (d) => {
        const angle = d.x! - Math.PI / 2;
        const r = d.y!;

        return `translate(${r * Math.cos(angle)},${r * Math.sin(angle)})`;
      })
      .attr('class', 'cursor-pointer')
      .on('click', (_event, d) => {
        if (d.data.id !== currentOrgId) {
          router.push(`/organizations/${d.data.id}`);
        }
      });

    // Circle for each node
    node
      .append('circle')
      .attr('r', 5)
      .attr('fill', (d) => (d.data.id === currentOrgId ? '#6366f1' : '#d4d4d8'))
      .attr('stroke', (d) =>
        d.data.id === currentOrgId ? '#4f46e5' : '#a1a1aa'
      )
      .attr('stroke-width', (d) => (d.data.id === currentOrgId ? 2 : 1));

    // Labels — always horizontal
    node
      .append('text')
      .attr('dy', '-0.8em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', (d) =>
        d.data.id === currentOrgId ? 'bold' : 'normal'
      )
      .attr('fill', (d) =>
        d.data.id === currentOrgId ? '#6366f1' : 'currentColor'
      )
      .text((d) => d.data.name);

    // Member count below name
    node
      .append('text')
      .attr('dy', '1.6em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#71717a')
      .text((d) => t('memberCount', { count: d.data.memberCount }));
  }, [tree, currentOrgId, router, t]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden px-4 pb-4 touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div className="absolute right-6 top-2 z-10 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white/90 px-1 py-0.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/90">
        <button
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          className="rounded px-2 py-0.5 text-lg leading-none text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={zoomReset}
          className="min-w-[3rem] rounded px-1 py-0.5 text-center text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          className="rounded px-2 py-0.5 text-lg leading-none text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <svg
        ref={svgRef}
        className="mx-auto w-full select-none text-zinc-800 dark:text-zinc-200"
        style={{ height: 'min(600px, 70vw)' }}
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}

export function OrgHierarchyTree({
  tree,
  currentOrgId,
}: OrgHierarchyTreeProps) {
  const t = useTranslations('organization.detail');
  const [expanded, setExpanded] = useState(true);

  // Don't render if tree has no children (standalone org)
  const hasHierarchy = tree.children.length > 0 || tree.id !== currentOrgId;

  if (!hasHierarchy) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between p-4">
        <Heading level={2}>{t('hierarchy')}</Heading>
        <Button plain onClick={() => setExpanded(!expanded)}>
          {expanded ? t('collapseHierarchy') : t('expandHierarchy')}
        </Button>
      </div>
      {expanded && (
        <TreeDiagram key={tree.id} tree={tree} currentOrgId={currentOrgId} />
      )}
    </div>
  );
}

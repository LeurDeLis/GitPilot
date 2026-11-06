import { Tooltip, Typography } from 'antd';
import { useMemo } from 'react';
import { useI18n } from '../i18n';
import type { CommitItem } from '../types/git';
import { formatDate } from '../utils/format';

type CommitHistoryProps = {
  commits: CommitItem[];
  onSelectCommit(commit: CommitItem): void;
};

type GraphNode = { commit: CommitItem; lane: number; index: number };

const ROW_HEIGHT = 64;
const GRAPH_LEFT = 15;
const LANE_GAP = 21;

function layoutGraph(commits: CommitItem[]): { nodes: GraphNode[]; width: number } {
  const visible = new Set(commits.map((commit) => commit.hash));
  const lanes: Array<string | undefined> = [];
  const nodes: GraphNode[] = [];

  commits.forEach((commit, index) => {
    let lane = lanes.indexOf(commit.hash);
    if (lane < 0) {
      lane = lanes.findIndex((item) => !item);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = commit.hash;
    }
    nodes.push({ commit, lane, index });

    const parents = commit.parents.filter((parent) => visible.has(parent));
    const occupied = new Set(lanes.filter(Boolean));
    lanes[lane] = undefined;
    if (parents[0] && !occupied.has(parents[0])) lanes[lane] = parents[0];
    for (const parent of parents.slice(1)) {
      if (lanes.includes(parent)) continue;
      const emptyLane = lanes.findIndex((item) => !item);
      if (emptyLane >= 0) lanes[emptyLane] = parent;
      else lanes.push(parent);
    }
    while (lanes.length && !lanes[lanes.length - 1]) lanes.pop();
  });

  return { nodes, width: Math.max(1, ...nodes.map((node) => node.lane + 1)) };
}

function createCommitColors(commits: CommitItem[]): Map<string, string> {
  const keys = Array.from(new Set(commits.map((commit) => {
    const date = new Date(commit.date);
    const day = Number.isNaN(date.getTime())
      ? commit.date.slice(0, 10)
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return `${commit.author}\0${day}`;
  })));
  return new Map(keys.map((key, index) => [key, `hsl(${(index * 137.508) % 360} 48% 52%)`]));
}

function commitColor(commit: CommitItem, colors: Map<string, string>): string {
  const date = new Date(commit.date);
  const day = Number.isNaN(date.getTime())
    ? commit.date.slice(0, 10)
    : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return colors.get(`${commit.author}\0${day}`) ?? 'var(--accent)';
}

export function CommitHistory({ commits, onSelectCommit }: CommitHistoryProps) {
  const { language, t } = useI18n();
  const { nodes, width: laneCount } = useMemo(() => layoutGraph(commits), [commits]);
  const colors = useMemo(() => createCommitColors(commits), [commits]);
  const graphWidth = GRAPH_LEFT * 2 + Math.max(0, laneCount - 1) * LANE_GAP;
  const graphHeight = commits.length * ROW_HEIGHT;
  const nodeByHash = new Map(nodes.map((node) => [node.commit.hash, node]));

  return (
    <div className="history-panel">
      {commits.length ? (
        <div className="history-graph-list" style={{ '--history-graph-width': `${graphWidth}px` } as React.CSSProperties}>
          <svg className="history-graph-lines" width={graphWidth} height={graphHeight} aria-hidden="true">
            {nodes.flatMap(({ commit, lane, index }) => commit.parents.flatMap((parentHash) => {
              const parent = nodeByHash.get(parentHash);
              if (!parent) return [];
              const x1 = GRAPH_LEFT + lane * LANE_GAP;
              const x2 = GRAPH_LEFT + parent.lane * LANE_GAP;
              const y1 = index * ROW_HEIGHT + ROW_HEIGHT / 2;
              const y2 = parent.index * ROW_HEIGHT + ROW_HEIGHT / 2;
              const middleY = (y1 + y2) / 2;
              return [<path key={`${commit.hash}-${parentHash}`} d={`M ${x1} ${y1} C ${x1} ${middleY}, ${x2} ${middleY}, ${x2} ${y2}`} className="history-edge" />];
            }))}
          </svg>
          {nodes.map(({ commit, lane, index }) => {
            const color = commitColor(commit, colors);
            const x = GRAPH_LEFT + lane * LANE_GAP;
            const details = `${commit.message}\n${commit.author}\n${formatDate(commit.date, language)}`;
            return (
              <div className="history-row" key={commit.hash}>
                <div className="history-node-cell" style={{ width: graphWidth }}>
                  <svg className="history-node" width={graphWidth} height={ROW_HEIGHT} role="button" tabIndex={0} aria-label={`${t('commitDetail')}: ${commit.shortHash} ${commit.message}`} onClick={() => onSelectCommit(commit)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectCommit(commit); }}>
                    <title>{details}</title>
                    <circle cx={x} cy={ROW_HEIGHT / 2} r="10" fill="transparent" />
                    <circle cx={x} cy={ROW_HEIGHT / 2} r="6" fill={color} className="history-node-dot" />
                  </svg>
                </div>
                <Tooltip title={details} placement="topLeft">
                  <button className="history-row-copy" onClick={() => onSelectCommit(commit)}>
                    <span className="history-row-heading">
                      <Typography.Text code>{commit.shortHash}</Typography.Text>
                      <Typography.Text className="history-message" ellipsis>{commit.message}</Typography.Text>
                    </span>
                    <Typography.Text type="secondary" className="history-meta">
                      {commit.author} / {formatDate(commit.date, language)}
                    </Typography.Text>
                  </button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      ) : (
        <Typography.Text type="secondary">{t('noCommitDetail')}</Typography.Text>
      )}
    </div>
  );
}

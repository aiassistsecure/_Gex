/**
 * FileTree — Recursive repo explorer with PCB trace styling
 */
import { useState } from 'react';
import useGexStore from '../store/useGexStore';
import { readFile } from '../services/api';

const FolderIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={open ? "var(--panel-border)" : "none"} stroke="var(--copper)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', flexShrink: 0 }}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginRight: '6px', flexShrink: 0 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
  </svg>
);

function TreeNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const { activeFile, setActiveFile, fileStatuses, addLog } = useGexStore();

  const isDir = node.type === 'directory';
  const isActive = !isDir && activeFile === node.path;
  const status = fileStatuses[node.rel_path];

  const handleClick = async () => {
    if (isDir) {
      setExpanded(!expanded);
      return;
    }

    try {
      const result = await readFile(node.path);
      setActiveFile(node.path, result.content);
      addLog(`Opened: ${node.name}`, 'dim');
    } catch (err) {
      addLog(`Failed to read: ${node.name} — ${err.message}`, 'error');
    }
  };

  return (
    <>
      <div
        className={`tree-item ${isDir ? 'dir' : ''} ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={handleClick}
        title={node.rel_path}
      >
        <span className="tree-item-icon" style={{ display: 'flex', alignItems: 'center' }}>
          {isDir ? <FolderIcon open={expanded} /> : <FileIcon />}
        </span>
        <span className="tree-item-name">{node.name}</span>
        {status && (
          <span className={`tree-status ${status}`} />
        )}
      </div>
      {isDir && expanded && node.children?.map((child, i) => (
        <TreeNode key={child.path || i} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default function FileTree() {
  const { repo } = useGexStore();

  if (!repo) {
    return (
      <div className="empty-state" style={{ opacity: 0.5 }}>
        <div style={{ marginBottom: '12px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <h3 style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>No Repository Scanned</h3>
        <p style={{ fontSize: '0.7rem' }}>Load and scan a repository to interact</p>
      </div>
    );
  }

  return (
    <div className="file-tree">
      {repo.tree.map((node, i) => (
        <TreeNode key={node.path || i} node={node} depth={0} />
      ))}
    </div>
  );
}

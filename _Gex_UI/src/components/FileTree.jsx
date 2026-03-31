/**
 * FileTree v1.0.0 -- File explorer with Lucide icons
 */
import useGexStore from '../store/useGexStore';
import { readFile } from '../services/api';
import {
  Folder, File, FileCode, FileJson, FileText, FileType,
  Palette, Globe, Database, Cpu, Hash, Cog
} from 'lucide-react';

function FileIcon({ type, ext }) {
  const size = 14;
  const sw = 1.5;
  if (type === 'directory') return <Folder size={size} strokeWidth={sw} />;

  const map = {
    py: FileCode, js: FileCode, jsx: FileCode, ts: FileCode, tsx: FileCode,
    rs: Cpu, go: Cpu, java: FileCode,
    css: Palette, html: Globe, json: FileJson, md: FileText,
    yml: Cog, yaml: Cog, toml: Cog,
    sql: Database, sh: Hash,
  };
  const Icon = map[ext] || File;
  return <Icon size={size} strokeWidth={sw} />;
}

function TreeNode({ node, depth = 0, activeFile, fileStatuses, onSelect }) {
  const isDir = node.type === 'directory';
  const ext = node.name?.split('.').pop()?.toLowerCase();
  const isActive = activeFile === node.path;

  // fileStatuses keys are relative paths (e.g. "src/auth.py") — node.path is absolute.
  // Match by checking if the absolute path ends with any relative key.
  const nodePosix = node.path.replace(/\\/g, '/');
  const status = fileStatuses[node.path]
    || Object.entries(fileStatuses).find(([k]) => nodePosix.endsWith(k.replace(/\\/g, '/')))?.[1]
    || null;

  const className = [
    'file-tree-item',
    isActive ? 'active' : '',
    status === 'patched' ? 'patched' : '',
    status === 'error' ? 'error' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        className={className}
        style={{ paddingLeft: `${14 + depth * 14}px` }}
        onClick={() => !isDir && onSelect(node)}
      >
        <span className="file-tree-icon">
          <FileIcon type={node.type} ext={ext} />
        </span>
        <span className="truncate">{node.name}</span>
        {status === 'patched' && (
          <span style={{ marginLeft: 'auto', fontSize: '0.5rem', color: 'var(--accent-green)' }}>*</span>
        )}
      </div>
      {isDir && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          activeFile={activeFile}
          fileStatuses={fileStatuses}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export default function FileTree() {
  const { repo, activeFile, fileStatuses, setActiveFile, addLog } = useGexStore();

  const handleSelect = async (node) => {
    try {
      const data = await readFile(node.path);
      setActiveFile(node.path, data.content);
    } catch (err) {
      addLog(`Failed to read: ${err.message}`, 'error');
    }
  };

  if (!repo || !repo.tree?.length) {
    return (
      <div className="empty-state" style={{ padding: '20px' }}>
        <p>Load a repository to see files</p>
      </div>
    );
  }

  return (
    <div style={{ fontSize: 'var(--font-size-sm)' }}>
      {repo.tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          activeFile={activeFile}
          fileStatuses={fileStatuses}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}

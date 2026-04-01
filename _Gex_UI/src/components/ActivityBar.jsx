/**
 * ActivityBar -- VS Code-style left icon strip
 */
import useGexStore from '../store/useGexStore';
import { FolderOpen, Search, Terminal, Settings, Palette } from 'lucide-react';

const ITEMS = [
  { id: 'explorer', label: 'Explorer',   Icon: FolderOpen },
  { id: 'search',   label: 'Search',     Icon: Search },
  { id: 'jenny',    label: 'Jenny CLI',  Icon: Terminal },
  { id: 'branding', label: 'Branding',   Icon: Palette },
];

export default function ActivityBar({ active, onSelect }) {
  return (
    <div className="activity-bar">
      {ITEMS.map(item => (
        <button
          key={item.id}
          className={`activity-btn ${active === item.id ? 'active' : ''}`}
          onClick={() => onSelect(item.id)}
          title={item.label}
        >
          <item.Icon size={18} strokeWidth={1.5} />
        </button>
      ))}

      <div className="activity-spacer" />

      <button
        className="activity-btn"
        onClick={() => useGexStore.getState().setShowSettings(true)}
        title="Settings"
      >
        <Settings size={18} strokeWidth={1.5} />
      </button>
    </div>
  );
}

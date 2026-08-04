import type { ReactNode } from 'react';

import type { OverlayTool } from '../../types/messages';

interface ToolbarProps {
  selectedTool: OverlayTool | null;
  onSelectTool: (tool: OverlayTool) => void;
  onShowList: () => void;
  onSaveHtml: () => void;
  onExit: () => void;
}

interface ToolButtonProps {
  label: string;
  icon: ReactNode;
  isSelected?: boolean;
  tone?: 'default' | 'danger';
  onClick: () => void;
}

function ToolButton({ label, icon, isSelected, tone = 'default', onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`memo-toolbar__button ${isSelected === true ? 'is-selected' : ''} ${tone === 'danger' ? 'is-danger' : ''}`}
      aria-label={label}
      aria-pressed={isSelected}
      title={label}
      onClick={onClick}
    >
      <span className="memo-toolbar__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="memo-toolbar__label">{label}</span>
    </button>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function Toolbar({
  selectedTool,
  onSelectTool,
  onShowList,
  onSaveHtml,
  onExit,
}: ToolbarProps) {
  return (
    <nav className="memo-toolbar" aria-label="웹 메모 도구">
      <div className="memo-toolbar__group" aria-label="메모 도구 선택">
        <ToolButton
          label="위치 메모"
          isSelected={selectedTool === 'point'}
          onClick={() => onSelectTool('point')}
          icon={
            <Icon>
              <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
              <circle cx="12" cy="10" r="2.2" />
            </Icon>
          }
        />
        <ToolButton
          label="텍스트 메모"
          isSelected={selectedTool === 'text'}
          onClick={() => onSelectTool('text')}
          icon={
            <Icon>
              <path d="M5 5h14M12 5v14M8.5 19h7" />
            </Icon>
          }
        />
        <ToolButton
          label="영역 메모"
          isSelected={selectedTool === 'area'}
          onClick={() => onSelectTool('area')}
          icon={
            <Icon>
              <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
            </Icon>
          }
        />
      </div>

      <div className="memo-toolbar__divider" />

      <div className="memo-toolbar__group" aria-label="메모 작업">
        <ToolButton
          label="메모 목록"
          onClick={onShowList}
          icon={
            <Icon>
              <path d="M9 6h11M9 12h11M9 18h11" />
              <circle cx="4.5" cy="6" r=".8" />
              <circle cx="4.5" cy="12" r=".8" />
              <circle cx="4.5" cy="18" r=".8" />
            </Icon>
          }
        />
        <ToolButton
          label="HTML 저장"
          onClick={onSaveHtml}
          icon={
            <Icon>
              <path d="M5 3h11l3 3v15H5V3Z" />
              <path d="M8 3v6h8V3M8 17h8" />
            </Icon>
          }
        />
      </div>

      <div className="memo-toolbar__divider" />

      <ToolButton
        label="메모 모드 종료"
        tone="danger"
        onClick={onExit}
        icon={
          <Icon>
            <path d="m6 6 12 12M18 6 6 18" />
          </Icon>
        }
      />
    </nav>
  );
}

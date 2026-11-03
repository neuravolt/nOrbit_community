// A Career -> Role -> Technology -> Level picker rendered as cascading rows of clickable pills
// instead of native <select> dropdowns — native selects render with the OS's own dropdown chrome
// (inconsistent styling, no sense of "this is a tree you're drilling into"), so this makes the
// drill-down itself look like the tree it actually is, each row appearing once its parent is
// picked.
import React from "react";
import { ChevronRight } from "lucide-react";

interface PickerItem {
  id: string;
  label: string;
}

function PillRow({ label, items, selectedId, onSelect, disabled }: { label: string; items: PickerItem[]; selectedId: string; onSelect: (id: string) => void; disabled?: boolean }) {
  if (disabled) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 pt-1.5 w-16 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-slate-400 italic py-1">loading…</span>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                selectedId === item.id
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
              }`}
            >
              {item.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function LevelPicker({
  careers, careerId, onCareerChange,
  roles, roleId, onRoleChange,
  techs, techId, onTechChange,
  levels, levelId, onLevelChange,
}: {
  careers: PickerItem[]; careerId: string; onCareerChange: (id: string) => void;
  roles: PickerItem[]; roleId: string; onRoleChange: (id: string) => void;
  techs: PickerItem[]; techId: string; onTechChange: (id: string) => void;
  levels: PickerItem[]; levelId: string; onLevelChange: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
      <PillRow label="Career" items={careers} selectedId={careerId} onSelect={onCareerChange} />
      {careerId && (
        <>
          <div className="pl-8"><ChevronRight className="w-3 h-3 text-slate-300 rotate-90" /></div>
          <PillRow label="Role" items={roles} selectedId={roleId} onSelect={onRoleChange} />
        </>
      )}
      {roleId && (
        <>
          <div className="pl-8"><ChevronRight className="w-3 h-3 text-slate-300 rotate-90" /></div>
          <PillRow label="Tech" items={techs} selectedId={techId} onSelect={onTechChange} />
        </>
      )}
      {techId && (
        <>
          <div className="pl-8"><ChevronRight className="w-3 h-3 text-slate-300 rotate-90" /></div>
          <PillRow label="Level" items={levels} selectedId={levelId} onSelect={onLevelChange} />
        </>
      )}
    </div>
  );
}

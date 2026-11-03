import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./node-status";
import { Trophy, Clock } from "lucide-react";

interface TreeNode {
  id: string;
  nodeNumber: number;
  title: string;
  status: string;
  xpReward?: number;
  estimatedDuration?: number;
}

interface TreeLevel {
  id: string;
  levelNumber: number;
  name: string;
  nodes: TreeNode[];
}

interface TechnologyTreeProps {
  technology: { name: string; description?: string };
  levels: TreeLevel[];
  progress: { overallProgressPercent: number };
  onNodeClick?: (nodeId: string) => void;
}

export function TechnologyTree({ technology, levels, progress, onNodeClick }: TechnologyTreeProps) {
  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-white p-6 border border-slate-200 rounded-xl">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{technology.name}</h3>
          {technology.description && <p className="text-sm text-slate-500 mt-1">{technology.description}</p>}
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Roadmap Progress</span>
          <span className="text-2xl font-extrabold text-slate-900">{progress.overallProgressPercent}%</span>
        </div>
      </div>

      {/* Levels list vertical timeline */}
      <div className="space-y-8 relative pl-6 border-l border-slate-200">
        {levels.map((level) => (
          <div key={level.id} className="space-y-4 relative">
            <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-4 border-white block" />
            <h4 className="font-extrabold text-base text-slate-900">
              Level {level.levelNumber}: {level.name}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {level.nodes.map((node) => {
                const isLocked = node.status === "locked";
                return (
                  <Card
                    key={node.id}
                    onClick={() => { if (!isLocked && onNodeClick) onNodeClick(node.id); }}
                    className={`border transition-all flex flex-col justify-between p-4 h-32 ${
                      isLocked
                        ? "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
                        : "bg-white border-slate-200 hover:shadow-md cursor-pointer"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-400 font-mono">NODE #{node.nodeNumber}</span>
                      <StatusBadge status={node.status} />
                    </div>

                    <span className="font-bold text-sm text-slate-800 line-clamp-2 mt-2 leading-relaxed">{node.title}</span>

                    <div className="flex items-center gap-3 pt-2 text-[10px] text-slate-400 font-bold uppercase">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" /> {node.xpReward || 100} XP
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {node.estimatedDuration || 60} Min
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

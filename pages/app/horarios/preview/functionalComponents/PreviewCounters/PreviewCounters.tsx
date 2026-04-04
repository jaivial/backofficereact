import { memo } from "react";
import { Clock3, Users } from "lucide-react";

type PreviewCountersProps = {
  liveCount: number;
  idleCount: number;
};

export const PreviewCounters = memo(function PreviewCounters({ liveCount, idleCount }: PreviewCountersProps) {
  return (
    <div data-ui="previewCounters" className="bo-horariosPreviewCounters">
      <div data-ui="liveCounter" className="bo-horariosPreviewCounter">
        <Users data-slot="counterIcon" size={14} strokeWidth={1.8} aria-hidden="true" />
        <span data-slot="counterLabel">{`En vivo: ${liveCount}`}</span>
      </div>
      <div data-ui="idleCounter" className="bo-horariosPreviewCounter">
        <Clock3 data-slot="counterIcon" size={14} strokeWidth={1.8} aria-hidden="true" />
        <span data-slot="counterLabel">{`Fuera de turno: ${idleCount}`}</span>
      </div>
    </div>
  );
});

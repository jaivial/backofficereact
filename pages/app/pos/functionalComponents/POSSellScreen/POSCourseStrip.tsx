import React from "react";
import { Flame } from "lucide-react";

import { cn } from "../../../../../ui/shadcn/utils";
import type { POSCourseSummary } from "../../types/register";

/**
 * The course picker and the fire buttons.
 *
 * The strip answers the two questions a waiter actually has mid-service: which
 * course am I ringing into, and what has the kitchen still not got. Courses with
 * nothing pending are dimmed rather than hidden, so the guest can see the second
 * course is already on its way.
 */
export function POSCourseStrip({ courses, activeCourse, onSelect, onFire, busy = false, readOnly = false }: {
  courses: POSCourseSummary[];
  activeCourse: string;
  onSelect: (course: string) => void;
  onFire: (course: string) => void;
  busy?: boolean;
  readOnly?: boolean;
}) {
  const known = new Set(courses.map((c) => c.course));
  // Offer one course past the highest in use, so the next service is one tap away
  // instead of a trip to a course picker.
  const highest = courses.reduce((max, c) => Math.max(max, Number(c.course) || 0), 0);
  const shown = Array.from(new Set([...known, String(highest + 1)])).sort((a, b) => Number(a) - Number(b));
  if (shown.length === 0) return null;

  return (
    <div className="pos-courses" data-testid="pos-courses">
      <span className="pos-courses__label" id="pos-courses-label">Curso</span>
      <div className="pos-courses__list" role="radiogroup" aria-labelledby="pos-courses-label">
        {shown.map((course) => {
          const summary = courses.find((c) => c.course === course);
          const pending = summary?.pendingLines ?? 0;
          const selected = course === activeCourse;
          return (
            <span className="pos-courses__item" key={course}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={cn("pos-courses__button", selected && "is-selected")}
                onClick={() => onSelect(course)}
                disabled={busy || readOnly}
                data-testid={`pos-course-${course}`}
                title={`Rings new dishes into course ${course}`}
              >
                {course}
                {pending > 0 ? <span className="pos-courses__pending" aria-label={`${pending} líneas sin enviar`}>{pending}</span> : null}
              </button>
              {pending > 0 && !readOnly ? (
                <button
                  type="button"
                  className="pos-courses__fire"
                  onClick={() => onFire(course)}
                  disabled={busy}
                  data-testid={`pos-course-fire-${course}`}
                  aria-label={`Enviar el curso ${course} a cocina`}
                  title={`Enviar el curso ${course} a cocina`}
                >
                  <Flame className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

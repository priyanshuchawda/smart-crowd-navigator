import type { CoreIntent } from "@smart-crowd-navigator/shared";

export const intentLabels: Record<CoreIntent, string> = {
  food: "Food",
  washroom: "Washroom",
  "entry-gate": "Entry Gate",
  exit: "Exit",
};

export const intentDescriptions: Record<CoreIntent, string> = {
  food: "Find the quickest food stop with the best timing.",
  washroom: "Avoid the busiest restroom queue near your section.",
  "entry-gate": "Choose the least-friction entry route for your group.",
  exit: "Leave smoothly with less crowd pressure and fewer bottlenecks.",
};

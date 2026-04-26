import type { Meta, StoryObj } from "@storybook/react";
import { TimeEntriesEditor, type EditableTimeEntry } from "./TimeEntriesEditor";

const sampleEntries: EditableTimeEntry[] = [
  {
    id: 1,
    startTime: "09:00",
    endTime: "12:30",
    minutesWorked: 210,
    source: "clock_autocut",
    isLive: false,
  },
  {
    id: 2,
    startTime: "14:00",
    endTime: "17:45",
    minutesWorked: 225,
    source: "clock_manual",
    isLive: false,
  },
];

const meta = {
  title: "ui/widgets/TimeEntriesEditor",
  component: TimeEntriesEditor,
  tags: ["autodocs"],
  argTypes: {
    entries: { control: "object" },
    busyEntryId: { control: "number" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof TimeEntriesEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    entries: sampleEntries,
    busyEntryId: null,
    onShiftStart: (id, delta) => console.log(`shiftStart: entry ${id} delta ${delta}`),
    onShiftEnd: (id, delta) => console.log(`shiftEnd: entry ${id} delta ${delta}`),
    onCloseLive: (id) => console.log(`closeLive: entry ${id}`),
  },
};

export const SingleEntry: Story = {
  name: "Single Entry",
  args: {
    entries: [sampleEntries[0]],
    busyEntryId: null,
    onShiftStart: (id, delta) => console.log(`shiftStart: entry ${id} delta ${delta}`),
    onShiftEnd: (id, delta) => console.log(`shiftEnd: entry ${id} delta ${delta}`),
    onCloseLive: (id) => console.log(`closeLive: entry ${id}`),
  },
};

export const WithLiveEntry: Story = {
  name: "With Live Entry",
  args: {
    entries: [
      ...sampleEntries,
      {
        id: 3,
        startTime: "18:00",
        endTime: null,
        minutesWorked: 45,
        source: "clock_autocut",
        isLive: true,
      },
    ],
    busyEntryId: null,
    onShiftStart: (id, delta) => console.log(`shiftStart: entry ${id} delta ${delta}`),
    onShiftEnd: (id, delta) => console.log(`shiftEnd: entry ${id} delta ${delta}`),
    onCloseLive: (id) => console.log(`closeLive: entry ${id}`),
  },
};

export const WithBusyEntry: Story = {
  name: "With Busy Entry",
  args: {
    entries: sampleEntries,
    busyEntryId: 1,
    onShiftStart: (id, delta) => console.log(`shiftStart: entry ${id} delta ${delta}`),
    onShiftEnd: (id, delta) => console.log(`shiftEnd: entry ${id} delta ${delta}`),
    onCloseLive: (id) => console.log(`closeLive: entry ${id}`),
  },
};

export const Empty: Story = {
  name: "Empty",
  args: {
    entries: [],
    busyEntryId: null,
    onShiftStart: (id, delta) => console.log(`shiftStart: entry ${id} delta ${delta}`),
    onShiftEnd: (id, delta) => console.log(`shiftEnd: entry ${id} delta ${delta}`),
    onCloseLive: (id) => console.log(`closeLive: entry ${id}`),
  },
};

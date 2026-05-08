import type { Meta, StoryObj } from '@storybook/react';
import { ProcessFlowDiagram } from '@altara/industrial';

const meta: Meta<typeof ProcessFlowDiagram> = {
  title: 'Industrial/ProcessFlowDiagram',
  component: ProcessFlowDiagram,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Composable SVG process-flow diagram. Tanks, pumps, heat exchangers, valves, and instrument bubbles connect via orthogonal flow paths. Live values per node update through the `values` prop.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ProcessFlowDiagram>;

export const Default: Story = {
  name: 'Default (3-tank flow)',
  args: { mockMode: true, width: 820, height: 320 },
};

export const Custom: Story = {
  name: 'Custom layout',
  args: {
    width: 600,
    height: 240,
    nodes: [
      { id: 't1', type: 'tank', x: 30, y: 60, label: 'TK-A' },
      { id: 'v1', type: 'valve', x: 200, y: 80, label: 'FV-A' },
      { id: 't2', type: 'tank', x: 360, y: 60, label: 'TK-B' },
    ],
    edges: [
      { from: 't1', to: 'v1', active: true },
      { from: 'v1', to: 't2', active: true },
    ],
    values: { t1: 75, v1: 22, t2: 38 },
  },
};

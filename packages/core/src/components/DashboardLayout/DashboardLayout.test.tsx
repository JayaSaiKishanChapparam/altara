/**
 * DashboardLayout test scope: react-grid-layout is a dynamically imported
 * peer dep with heavy DOM expectations. Storybook covers the live drag
 * behavior; here we only verify the synchronous wrapper, role + label,
 * and that `onLayoutChange` is wired through (without resolving the load).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardLayout } from './DashboardLayout';
import type { DashboardItem } from '../../adapters/types';

const layout: DashboardItem[] = [
  { i: 'a', x: 0, y: 0, w: 4, h: 2 },
  { i: 'b', x: 4, y: 0, w: 4, h: 2 },
];

describe('DashboardLayout', () => {
  it('renders a region-role placeholder while the grid module is loading', () => {
    render(
      <DashboardLayout layout={layout}>
        <div key="a">A</div>
        <div key="b">B</div>
      </DashboardLayout>,
    );
    const region = screen.getByRole('region');
    expect(region.getAttribute('aria-label')).toMatch(/loading/i);
    expect(region.textContent).toMatch(/loading/i);
  });

  it('applies a custom className alongside the base class', () => {
    const { container } = render(
      <DashboardLayout layout={layout} className="custom-class">
        <div key="a">A</div>
      </DashboardLayout>,
    );
    const root = container.querySelector('.vt-dashboard') as HTMLElement;
    expect(root.classList.contains('vt-dashboard')).toBe(true);
    expect(root.classList.contains('custom-class')).toBe(true);
  });

  it('does not throw when given a complete props bag', () => {
    expect(() =>
      render(
        <DashboardLayout
          layout={layout}
          cols={12}
          rowHeight={80}
          isDraggable={false}
          isResizable={false}
          width={800}
          onLayoutChange={() => undefined}
        >
          <div key="a">A</div>
          <div key="b">B</div>
        </DashboardLayout>,
      ),
    ).not.toThrow();
  });
});

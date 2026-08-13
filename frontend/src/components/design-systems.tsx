'use client';

import { gql } from '@apollo/client';
import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select';

/** One design system as the picker needs it — tokens stay server-side. */
export interface DesignSystemChoice {
  id: string;
  name: string;
  category: string;
  blurb: string;
  bg: string;
  surface: string;
  fg: string;
  accent: string;
}

export const DESIGN_SYSTEMS = gql`
  query DesignSystems {
    designSystems {
      id
      name
      category
      blurb
      bg
      surface
      fg
      accent
    }
  }
`;

export const RESTYLE_PROJECT = gql`
  mutation RestyleProject($projectId: ID!, $styleId: String!) {
    restyleProject(projectId: $projectId, styleId: $styleId) {
      ok
      message
    }
  }
`;

/** A style, shown as itself: canvas, text, accent. */
export function Swatch({ system }: { system?: DesignSystemChoice }) {
  if (!system) return null;
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60"
      style={{ background: system.bg }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: system.accent }}
      />
    </span>
  );
}

/**
 * Systems under their category heading, both in the order the backend sent
 * them. A flat list of 150+ styles is a scroll, not a choice.
 */
export function groupByCategory(
  systems: DesignSystemChoice[]
): [string, DesignSystemChoice[]][] {
  const groups = new Map<string, DesignSystemChoice[]>();
  for (const system of systems) {
    const key = system.category || 'Other';
    groups.set(key, [...(groups.get(key) ?? []), system]);
  }
  return [...groups];
}

/**
 * The grouped option list, for use inside a <SelectContent>. Shared so the
 * composer's picker and the workbench's restyle menu cannot drift apart.
 */
export function DesignSystemOptions({
  systems,
}: {
  systems: DesignSystemChoice[];
}) {
  return (
    <>
      {groupByCategory(systems).map(([category, group]) => (
        <SelectGroup key={category}>
          <SelectLabel>{category}</SelectLabel>
          {group.map((system) => (
            <SelectItem key={system.id} value={system.id}>
              <div className="flex items-center gap-2.5">
                <Swatch system={system} />
                <div className="flex flex-col items-start">
                  <span className="font-semibold">{system.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {system.blurb}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );
}

/** What you can make. Lives here beside the style catalog: both are the
 *  composer's public "shape of the thing" queries. */
export interface ScenarioChoice {
  id: string;
  name: string;
  blurb: string;
}

export const SCENARIOS = gql`
  query Scenarios {
    scenarios {
      id
      name
      blurb
    }
  }
`;

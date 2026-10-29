// Identity and navigation. The visual system lives in theme/; this file names things.
import {
  LayoutDashboard, MapPin, Scale, MessageSquareText, CircleDollarSign,
  BookOpen, DatabaseZap, ListChecks,
} from 'lucide-react'

export const brand = {
  name: 'Alpha Manufacturing',
  workspace: 'Retention Analytics',
  builtBy: 'Built by Protea Consulting Group',
}

// `filters`: the page reads Alpha's data, so the global filters apply to it.
export const NAV_GROUPS = [
  {
    label: 'Retention',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, filters: true,
        description: 'SQ1 · How many employees left, at what rate, and how has that changed month by month?' },
      { id: 'where', label: 'Where', icon: MapPin, filters: true,
        description: 'SQ2 · Which plants, departments, roles and shifts run well above the company rate?' },
      { id: 'factors', label: 'Factors', icon: Scale, filters: true,
        description: 'SQ3 · How do leavers differ from stayers on pay, workload, satisfaction and training?' },
      { id: 'voice', label: 'Employee voice', icon: MessageSquareText, filters: true,
        description: 'SQ4 · What do surveys and exit interviews say, and how many people do they cover?' },
      { id: 'cost', label: 'Cost & scenarios', title: 'Cost and scenarios', icon: CircleDollarSign, filters: true,
        description: 'SQ5 · What do departures cost, and what would a realistic improvement save?' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { id: 'discovery', label: 'Data discovery', icon: DatabaseZap,
        description: 'What Alpha\'s database holds, read live. Fills in as soon as access is granted.' },
      { id: 'definitions', label: 'Definitions', icon: BookOpen,
        description: 'Every rate states its population, numerator and denominator.' },
      { id: 'readiness', label: 'Build status', icon: ListChecks,
        description: 'What works tonight, and what waits on Alpha\'s data.' },
    ],
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

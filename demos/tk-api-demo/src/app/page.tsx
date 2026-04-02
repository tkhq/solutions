import Link from 'next/link'
import { getScenarios } from '@/lib/scenarios'

export default function Home() {
  const scenarios = getScenarios()

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            TK
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase">
            Turnkey
          </span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">API Demo</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Interactive walkthroughs of Turnkey&apos;s wallet infrastructure and policy engine.
          All API calls are real.
        </p>
      </div>

      <div className="space-y-4">
        {scenarios.map((scenario) => (
          <Link
            key={scenario.id}
            href={`/demo/${scenario.id}`}
            className="block border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-transparent hover:border-violet-400 dark:hover:border-violet-500/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                  {scenario.name}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  {scenario.description}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-3 mt-0.5">
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {scenario.steps.length} steps
                </span>
                <span className="text-gray-400 dark:text-gray-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors text-lg leading-none">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}

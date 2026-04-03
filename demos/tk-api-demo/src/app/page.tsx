import Link from 'next/link'

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-black.svg" alt="Turnkey" height={22} className="dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-white.svg" alt="Turnkey" height={22} className="hidden dark:block" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Setup Assistant</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          Configure your Turnkey integration step by step. Each action runs against your real org and generates the server code you need.
        </p>
      </div>

      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Guided Setup</p>
      <div className="space-y-4">
        {/* Parent Org */}
        <Link href="/setup/parent" className="block border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-transparent hover:border-violet-400 dark:hover:border-violet-500/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all group">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">Step 1</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">Configure Parent Org</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Set your org name, enable features, create user and key tags, and define top-level policies.</p>
            </div>
            <span className="text-gray-400 dark:text-gray-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors text-lg leading-none shrink-0 mt-1">→</span>
          </div>
        </Link>

        {/* Sub-Org */}
        <Link href="/setup/sub-org" className="block border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-transparent hover:border-violet-400 dark:hover:border-violet-500/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all group">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">Step 2</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">Set Up Sub-Org</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Create a sub-organization for an end user, configure their wallet and policies, then hand off access.</p>
            </div>
            <span className="text-gray-400 dark:text-gray-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors text-lg leading-none shrink-0 mt-1">→</span>
          </div>
        </Link>
      </div>

      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-10 mb-3">Custom Setups</p>
      <div className="space-y-4">
        <Link href="/build?flow=parent" className="block border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:border-violet-400 dark:hover:border-violet-500/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all group">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">Custom Parent Org Setup</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Pick any combination of activities and queries to run against your parent org.</p>
            </div>
            <span className="text-gray-400 dark:text-gray-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors text-lg leading-none shrink-0 mt-1">→</span>
          </div>
        </Link>

        <Link href="/build?flow=sub-org" className="block border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:border-violet-400 dark:hover:border-violet-500/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all group">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">Custom Sub-Org Setup</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Compose a custom sub-org configuration using any available activities and queries.</p>
            </div>
            <span className="text-gray-400 dark:text-gray-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors text-lg leading-none shrink-0 mt-1">→</span>
          </div>
        </Link>
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-900 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-black.svg" alt="Secured by Turnkey" height={18} className="dark:hidden opacity-40" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-white.svg" alt="Secured by Turnkey" height={18} className="hidden dark:block opacity-30" />
      </div>
    </main>
  )
}

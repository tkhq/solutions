'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { StepConfig } from '@/types/scenario'

// ── Types ──────────────────────────────────────────────────────────────────────

type AppType = 'consumer' | 'institutional' | 'gaming' | 'treasury'
type Signing = 'custodial' | 'self-custody' | 'shared'
type Chains = 'evm' | 'solana' | 'bitcoin' | 'multi'
type Restrictions = 'none' | 'allowlist' | 'sign-only' | 'later'

type Answers = {
  appType: AppType
  signing: Signing
  chains: Chains
  restrictions: Restrictions
}

type RecommendedStep = StepConfig & { reason: string; optional?: boolean }

type Recommendation = {
  parentSteps: RecommendedStep[]
  subOrgSteps: RecommendedStep[]
  summary: string
}

// ── Recommendation engine ──────────────────────────────────────────────────────

function getRecommendation(answers: Answers): Recommendation {
  const { appType, signing, chains, restrictions } = answers
  const isTreasury = appType === 'treasury'

  // ── Parent org steps ─────────────────────────────────────────────────────────
  const parentSteps: RecommendedStep[] = []

  parentSteps.push({
    kind: 'GET_WHO_AM_I',
    title: 'Verify Credentials',
    description: 'Confirm your API keys are working and inspect your organization.',
    reason: 'Verify your API credentials and confirm root org access before making changes.',
  })

  parentSteps.push({
    kind: 'UPDATE_ORGANIZATION_NAME',
    title: 'Set Organization Name',
    description: 'Give your organization a clear name for identification.',
    reason: 'Give your org a clear name that reflects your application.',
  })

  if (appType === 'consumer') {
    parentSteps.push({
      kind: 'SET_ORG_FEATURE',
      title: 'Enable Org Features',
      description: 'Enable features your application needs, such as email auth or advanced policies.',
      reason: 'Enable email auth or OTP features your end users will need for account recovery.',
    })
  }

  if (!isTreasury) {
    parentSteps.push({
      kind: 'CREATE_USER_TAG',
      title: 'Create User Tag',
      description: 'Create a tag to classify users in your sub-orgs (e.g. "end-user", "admin").',
      reason: "Tag users by role (e.g. 'end-user') to use in policy expressions.",
    })
  }

  if (appType === 'institutional' || isTreasury) {
    parentSteps.push({
      kind: 'CREATE_PRIVATE_KEY_TAG',
      title: 'Create Private Key Tag',
      description: 'Create a tag to classify private keys (e.g. "hot-wallet", "cold-storage").',
      reason: "Tag private keys by type (e.g. 'hot-wallet', 'cold-storage') for policy-based controls.",
    })
  }

  // Treasury keeps wallets directly in the parent org — no sub-orgs
  if (isTreasury) {
    const walletReasonMap: Record<Chains, string> = {
      evm: 'Create your Ethereum/EVM treasury wallet directly in the parent org.',
      solana: 'Create your Solana treasury wallet directly in the parent org.',
      bitcoin: 'Create your Bitcoin treasury wallet directly in the parent org.',
      multi: 'Create your primary treasury wallet — add accounts for each chain after.',
    }
    parentSteps.push({
      kind: 'CREATE_WALLET',
      title: 'Create Treasury Wallet',
      description: 'Create the primary wallet held directly in this organization.',
      reason: walletReasonMap[chains],
    })
    if (chains === 'multi') {
      parentSteps.push({
        kind: 'CREATE_WALLET_ACCOUNTS',
        title: 'Create Wallet Accounts',
        description: 'Add additional accounts for each chain to the treasury wallet.',
        reason: 'Add Solana, Bitcoin, or other chain accounts to the same HD wallet.',
      })
    }
  }

  if (restrictions !== 'later') {
    const policyParams = restrictions === 'none' ? { type: 'permissive' }
      : restrictions === 'allowlist' ? { type: 'allow-all' }
      : { type: 'sign-only' }
    const policyReason = restrictions === 'none'
      ? isTreasury ? 'Allow all signing — tighten this after adding quorum controls.' : 'Create a permissive policy to allow all signing operations in your org.'
      : restrictions === 'allowlist' ? "Create a base policy — you'll add address restrictions per wallet."
      : 'Restrict to signing operations only — prevents any admin actions from your API user.'
    parentSteps.push({
      kind: 'CREATE_POLICY',
      title: isTreasury ? 'Create Treasury Policy' : 'Create Org Policy',
      description: 'Create a top-level policy governing signing permissions across your organization.',
      params: policyParams,
      reason: policyReason,
    })
  }

  if (!isTreasury || signing !== 'self-custody') {
    // For treasury: create API user for server-side signing of treasury wallets
    if (isTreasury) {
      parentSteps.push({
        kind: 'CREATE_API_USER',
        title: 'Create API User',
        description: 'Create an API-only user for server-side access to treasury signing.',
        reason: 'Create a server-side API user that will sign transactions on behalf of the treasury.',
      })
    }
  }

  // All scenarios: invite team members who need org access
  parentSteps.push({
    kind: 'CREATE_INVITATIONS',
    title: 'Invite Team Members',
    description: 'Send invitations to team members who need access to this organization.',
    reason: isTreasury
      ? 'Invite finance team members, auditors, or approvers who need visibility into the treasury.'
      : 'Invite developers or admins who need access to manage the org or respond to incidents.',
  })

  // All scenarios: optionally harden with multi-sig root quorum
  parentSteps.push({
    kind: 'UPDATE_ROOT_QUORUM',
    title: 'Update Root Quorum',
    description: 'Require multiple approvers for root-level actions, eliminating single points of failure.',
    reason: isTreasury
      ? 'Require M-of-N approval for any root action — critical for treasury operations where mistakes are costly.'
      : 'Add a second approver for root actions so no single API key can make destructive changes.',
    optional: true,
  })

  // ── Sub-org steps (not used for treasury) ────────────────────────────────────
  const subOrgSteps: RecommendedStep[] = []

  if (!isTreasury) {
    subOrgSteps.push({
      kind: 'CREATE_SUB_ORG',
      title: 'Create Sub-Organization',
      description: 'Create a sub-org for your end user. You retain root access during setup.',
      reason: 'Create a dedicated sub-org for each end user — you retain root access during setup.',
    })

    const walletReasonMap: Record<Chains, string> = {
      evm: 'Create an Ethereum wallet with a standard EVM account.',
      solana: 'Create a Solana wallet with an ed25519 account.',
      bitcoin: 'Create a Bitcoin wallet with a P2WPKH account.',
      multi: 'Create a primary wallet — add accounts for each chain after.',
    }

    subOrgSteps.push({
      kind: 'CREATE_WALLET',
      title: 'Create Wallet',
      description: 'Create the primary wallet for this sub-org.',
      reason: walletReasonMap[chains],
    })

    if (chains === 'multi') {
      subOrgSteps.push({
        kind: 'CREATE_WALLET_ACCOUNTS',
        title: 'Create Wallet Accounts',
        description: 'Add additional accounts to the wallet for each chain.',
        reason: 'Add additional chain accounts (Solana, Bitcoin) to the same HD wallet.',
      })
    }

    if (restrictions !== 'later') {
      const policyParams = restrictions === 'none' ? { type: 'permissive' }
        : restrictions === 'allowlist' ? { type: 'permissive' }
        : { type: 'sign-only' }
      const policyReason = restrictions === 'none'
        ? 'Allow all signing in this sub-org — suitable for a managed custodial setup.'
        : restrictions === 'allowlist' ? "Create a policy you'll customize with the end user's allowed addresses."
        : 'Restrict this sub-org to signing only — prevents wallet creation or user changes.'
      subOrgSteps.push({
        kind: 'CREATE_POLICY',
        title: 'Create Sub-Org Policy',
        description: 'Create a signing policy scoped to this sub-org.',
        params: policyParams,
        reason: policyReason,
      })
    }

    if (signing !== 'self-custody') {
      subOrgSteps.push({
        kind: 'CREATE_API_USER',
        title: 'Create API User',
        description: 'Create an API-only user for server-side access.',
        reason: 'Create a server-side API user for programmatic access to this sub-org.',
      })
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  let summary: string
  if (isTreasury) {
    summary = 'Internal treasury setup — wallets and users live directly in the parent org. No sub-orgs needed. Team members are invited and root quorum can be set for multi-approver security.'
  } else if (appType === 'gaming') {
    summary = 'Gaming or NFT platform setup. Wallets are created per user in isolated sub-orgs with policies to control what assets can be moved.'
  } else if (appType === 'institutional') {
    summary = 'Institutional platform with policy-based signing controls. Tags and policies give you fine-grained access control across sub-orgs.'
  } else if (signing === 'custodial') {
    summary = 'Embedded wallet app with server-managed signing. Each user gets an isolated sub-org with a wallet and a permissive signing policy.'
  } else {
    summary = 'Consumer wallet app where users control their own keys. Sub-orgs are set up server-side before handing off to the end user.'
  }

  return { parentSteps, subOrgSteps, summary }
}

// ── Question data ──────────────────────────────────────────────────────────────

const questions = [
  {
    key: 'appType' as const,
    text: 'What type of application are you building?',
    options: [
      { value: 'consumer' as const, label: 'Consumer wallet app', sublabel: 'Users manage their own assets' },
      { value: 'institutional' as const, label: 'Trading / institutional', sublabel: 'Institutional or high-volume platform' },
      { value: 'gaming' as const, label: 'Gaming or NFT platform', sublabel: 'Game items, collectibles, or NFTs' },
      { value: 'treasury' as const, label: 'Internal treasury / custody', sublabel: 'Company-controlled funds' },
    ],
  },
  {
    key: 'signing' as const,
    text: 'How will signing be managed?',
    options: [
      { value: 'custodial' as const, label: 'My server signs everything', sublabel: 'Fully custodial' },
      { value: 'self-custody' as const, label: 'Users control their own credentials', sublabel: 'Self-custody' },
      { value: 'shared' as const, label: 'Mix of server and user policies', sublabel: 'Shared control' },
    ],
  },
  {
    key: 'chains' as const,
    text: 'Which chains do you need?',
    options: [
      { value: 'evm' as const, label: 'Ethereum / EVM only', sublabel: 'Ethereum, Polygon, Base, etc.' },
      { value: 'solana' as const, label: 'Solana only', sublabel: 'Solana mainnet or devnet' },
      { value: 'bitcoin' as const, label: 'Bitcoin only', sublabel: 'BTC mainnet or testnet' },
      { value: 'multi' as const, label: 'Multiple chains', sublabel: 'EVM + Solana, Bitcoin, and more' },
    ],
  },
  {
    key: 'restrictions' as const,
    text: 'What signing restrictions do you want to start with?',
    options: [
      { value: 'none' as const, label: 'Allow all signing', sublabel: 'No restrictions' },
      { value: 'allowlist' as const, label: 'Restrict by destination address', sublabel: 'Allowlist model' },
      { value: 'sign-only' as const, label: 'Signing operations only', sublabel: 'No admin actions' },
      { value: 'later' as const, label: "I'll define this later", sublabel: 'Skip policy setup for now' },
    ],
  },
]

// ── Page component ─────────────────────────────────────────────────────────────

type PartialAnswers = Partial<Answers>

export default function RecommendPage() {
  const router = useRouter()
  const [view, setView] = useState<'questions' | 'results'>('questions')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<PartialAnswers>({})
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)

  function handleSelect(value: string) {
    const q = questions[currentQuestion]
    const updated = { ...answers, [q.key]: value } as PartialAnswers

    setAnswers(updated)

    if (currentQuestion < questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestion(currentQuestion + 1)
      }, 100)
    } else {
      setTimeout(() => {
        const rec = getRecommendation(updated as Answers)
        setRecommendation(rec)
        setView('results')
      }, 100)
    }
  }

  function handleBack() {
    if (currentQuestion === 0) {
      router.push('/')
    } else {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  function launchParent(steps: RecommendedStep[]) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const stepConfigs: StepConfig[] = steps.map(({ reason: _r, optional: _o, ...s }) => s)
    sessionStorage.setItem('custom-setup-parent', JSON.stringify(stepConfigs))
    router.push('/setup/custom/parent')
  }

  function launchSubOrg(steps: RecommendedStep[]) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const stepConfigs: StepConfig[] = steps.map(({ reason: _r, optional: _o, ...s }) => s)
    sessionStorage.setItem('custom-setup-sub-org', JSON.stringify(stepConfigs))
    router.push('/setup/custom/sub-org')
  }

  const q = questions[currentQuestion]
  const selectedValue = answers[q?.key]

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-black.svg" alt="Turnkey" height={22} className="dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-white.svg" alt="Turnkey" height={22} className="hidden dark:block" />
      </div>

      {view === 'questions' && (
        <div>
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-6"
            >
              <span>←</span>
              <span>{currentQuestion === 0 ? 'Home' : 'Back'}</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Guided Setup Recommender</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Answer a few questions to get a recommended Turnkey setup.</p>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">{currentQuestion + 1} of {questions.length}</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-6">
            <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[11px] font-semibold uppercase tracking-wider mb-3">
              {currentQuestion + 1} of {questions.length}
            </div>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{q.text}</p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {q.options.map((opt) => {
              const isSelected = selectedValue === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={[
                    'border rounded-xl p-4 cursor-pointer transition-all text-left',
                    isSelected
                      ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600',
                  ].join(' ')}
                >
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {view === 'results' && recommendation && (
        <div>
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => {
                setView('questions')
                setCurrentQuestion(questions.length - 1)
              }}
              className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-6"
            >
              <span>←</span>
              <span>Back</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Recommended Setup</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{recommendation.summary}</p>
          </div>

          {/* Result panels — single column for treasury, two columns otherwise */}
          <div className={`grid grid-cols-1 gap-6 ${recommendation.subOrgSteps.length > 0 ? 'sm:grid-cols-2' : ''}`}>
            {/* Parent org */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Parent Org Setup</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">
                  {recommendation.parentSteps.length} step{recommendation.parentSteps.length !== 1 ? 's' : ''}
                </span>
              </div>

              <ol className="space-y-3 mb-5 flex-1">
                {recommendation.parentSteps.map((step, i) => (
                  <li key={`${step.kind}-${i}`} className="flex gap-3">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5 ${
                      step.optional
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                        : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{step.title}</p>
                        {step.optional && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full shrink-0">
                            optional
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{step.reason}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <button
                onClick={() => launchParent(recommendation.parentSteps)}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                Start Parent Org Setup &rarr;
              </button>
            </div>

            {/* Sub-org — only shown for non-treasury scenarios */}
            {recommendation.subOrgSteps.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Sub-Org Setup</h2>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">
                    {recommendation.subOrgSteps.length} step{recommendation.subOrgSteps.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <ol className="space-y-3 mb-5 flex-1">
                  {recommendation.subOrgSteps.map((step, i) => (
                    <li key={`${step.kind}-${i}`} className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{step.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{step.reason}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <button
                  onClick={() => launchSubOrg(recommendation.subOrgSteps)}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  Start Sub-Org Setup &rarr;
                </button>
              </div>
            )}
          </div>

          {/* Start over */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAnswers({})
                setCurrentQuestion(0)
                setRecommendation(null)
                setView('questions')
              }}
              className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-900 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-black.svg" alt="Secured by Turnkey" height={18} className="dark:hidden opacity-40" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-white.svg" alt="Secured by Turnkey" height={18} className="hidden dark:block opacity-30" />
      </div>
    </main>
  )
}

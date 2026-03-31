const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Use cases', href: '#use-cases' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const credibilityItems = [
  '50 free AI requests/day',
  'Bring your own OpenAI or Anthropic key',
  'AES-256 GCM encryption',
  'No training on your data',
];

const featureCards = [
  {
    title: 'Human oversight built in',
    description:
      'Use AI mode for speed, Shadow mode for review, or Takeover mode when a human should step in instantly.',
  },
  {
    title: 'Answers grounded in your business',
    description:
      'Train AiAssist with your FAQs, policies, product details, and brand context so replies stay relevant and accurate.',
  },
  {
    title: 'Control tone, rules, and behavior',
    description:
      'Set directives for personality, constraints, and response style so every answer sounds like your team.',
  },
  {
    title: 'Ready for real operations',
    description:
      'Create separate workspaces, manage team roles, monitor conversations, and connect through an OpenAI-compatible API.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Add your knowledge',
    description:
      'Upload the facts your assistant should know: product info, FAQs, policies, and company context.',
  },
  {
    number: '02',
    title: 'Set rules and tone',
    description:
      'Define how the AI should behave with directives, constraints, and persona settings.',
  },
  {
    number: '03',
    title: 'Launch with the right level of control',
    description:
      'Go live in AI, Shadow, or Takeover mode depending on how much autonomy your team wants.',
  },
];

const useCases = [
  {
    title: 'SaaS support teams',
    description:
      'Deflect repetitive tickets, answer product questions faster, and keep agents focused on high-value conversations.',
  },
  {
    title: 'Agencies and resellers',
    description:
      'Run separate client workspaces, manage permissions, and offer branded AI support as a service.',
  },
  {
    title: 'Operations-led SMBs',
    description:
      'Give customers instant answers without hiring a larger support team or stitching together multiple tools.',
  },
];

const comparisonRows = [
  {
    label: 'Fast 24/7 responses',
    aiAssist: true,
    generic: true,
    manual: false,
  },
  {
    label: 'Human review before sending',
    aiAssist: true,
    generic: false,
    manual: true,
  },
  {
    label: 'Custom knowledge base',
    aiAssist: true,
    generic: false,
    manual: true,
  },
  {
    label: 'Brand and policy controls',
    aiAssist: true,
    generic: false,
    manual: true,
  },
  {
    label: 'Scales without adding headcount',
    aiAssist: true,
    generic: true,
    manual: false,
  },
];

const testimonials = [
  {
    quote:
      'AiAssist gave us a safer path into AI support. Shadow mode let us review drafts first, then automate with confidence.',
    name: 'Maya R.',
    role: 'Head of Support, B2B SaaS',
  },
  {
    quote:
      'We tested generic chatbots before. AiAssist felt different because we could shape the answers and keep our team in control.',
    name: 'Daniel K.',
    role: 'Founder, Ecommerce Brand',
  },
  {
    quote:
      'The workspace model made it easy to manage multiple client assistants without creating a mess behind the scenes.',
    name: 'Priya S.',
    role: 'Agency Operator',
  },
];

const faqs = [
  {
    question: 'Is there a free trial?',
    answer:
      'Yes. The free tier includes 50 AI requests per day forever, with no credit card required.',
  },
  {
    question: 'Can I use my own OpenAI or Anthropic API key?',
    answer: 'Yes. BYOK support is available.',
  },
  {
    question: 'How secure is my data?',
    answer:
      'All data is encrypted in transit and at rest with AES-256 GCM. AiAssist does not train on your data, and admin access is blind.',
  },
  {
    question: 'Can multiple team members use one account?',
    answer:
      'Yes. Team plans support multiple seats with role-based permissions.',
  },
  {
    question: 'Can I white-label the chat widget?',
    answer:
      'Enterprise plans include white-labeling options. Contact sales for details.',
  },
  {
    question: 'How do I cancel?',
    answer:
      'Go to Dashboard > Account Settings > Subscription and click Cancel. You keep access until the end of your billing period.',
  },
];

function SectionLabel({ children }) {
  return (
    <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gene-200">
      {children}
    </div>
  );
}

function CheckIcon({ enabled }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
        enabled
          ? 'bg-emerald-500/20 text-emerald-300'
          : 'bg-white/5 text-slate-500'
      }`}
      aria-hidden="true"
    >
      {enabled ? '✓' : '—'}
    </span>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(109,124,255,0.18),transparent_30%),linear-gradient(180deg,#0b1020_0%,#0a0f1d_100%)] text-slate-50">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1020]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gene-500/20 text-lg font-bold text-gene-200 ring-1 ring-gene-400/30">
              A
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">AiAssist</div>
              <div className="text-xs text-slate-400">AI support with human control</div>
            </div>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-slate-300 transition hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href="#pricing"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
            >
              See pricing
            </a>
            <a
              href="#final-cta"
              className="rounded-full bg-gene-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(109,124,255,0.35)] transition hover:bg-gene-400"
            >
              Start free
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <SectionLabel>AI customer support, without the risk</SectionLabel>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Deploy AI customer support your team can actually trust
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Train AiAssist on your business, control how it responds, and keep humans in the
                loop with Shadow and Takeover modes. Launch in minutes, not months.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#pricing"
                  className="inline-flex items-center justify-center rounded-full bg-gene-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_12px_40px_rgba(109,124,255,0.35)] transition hover:bg-gene-400"
                >
                  Start free
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-base font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                >
                  See how it works
                </a>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-400">
                <span>No credit card required</span>
                <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:inline-block" />
                <span>50 free requests/day</span>
                <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:inline-block" />
                <span>BYOK supported</span>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {credibilityItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200 backdrop-blur"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-gene-500/20 blur-3xl" />
              <div className="absolute -bottom-8 right-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Workspace: Acme Support</p>
                    <p className="text-sm text-slate-400">Mode: Shadow</p>
                  </div>
                  <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Human review on
                  </div>
                </div>

                <div className="space-y-4 py-6">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gene-500 px-4 py-3 text-sm text-white">
                    Can I cancel anytime if we start on a paid plan?
                  </div>
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-white/10 bg-[#121a31] px-4 py-3 text-sm text-slate-100">
                    Draft reply: Yes — you can cancel from Dashboard &gt; Account Settings &gt;
                    Subscription. You’ll keep access until the end of your billing period.
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20">
                      ✓
                    </span>
                    Approved by support lead before sending
                  </div>
                </div>

                <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Speed</div>
                    <div className="mt-2 text-2xl font-semibold text-white">24/7</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Control</div>
                    <div className="mt-2 text-2xl font-semibold text-white">3 modes</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Setup</div>
                    <div className="mt-2 text-2xl font-semibold text-white">Minutes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.03] px-6 py-8 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Built for teams that need speed, accuracy, and control
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300 lg:justify-end">
              <span className="rounded-full border border-white/10 px-4 py-2">Free tier forever</span>
              <span className="rounded-full border border-white/10 px-4 py-2">OpenAI-compatible API</span>
              <span className="rounded-full border border-white/10 px-4 py-2">Role-based access</span>
              <span className="rounded-full border border-white/10 px-4 py-2">Enterprise security</span>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionLabel>The problem</SectionLabel>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Customers want instant answers. Your team still needs accuracy.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
                Manual support is slow and expensive to scale. Generic AI tools are fast, but they
                can go off-script, miss context, or say the wrong thing at the worst moment.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <SectionLabel>The solution</SectionLabel>
              <p className="text-lg leading-8 text-slate-200">
                AiAssist gives you a middle path: fast AI responses grounded in your knowledge,
                shaped by your rules, and backed by human oversight when needed.
              </p>
              <ul className="mt-6 space-y-4 text-slate-300">
                <li>• Answer repetitive questions instantly</li>
                <li>• Keep replies aligned with your policies and tone</li>
                <li>• Review drafts before they go live when risk is high</li>
                <li>• Step in seamlessly when a human should take over</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="features" className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <SectionLabel>Why teams choose AiAssist</SectionLabel>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Built to improve support outcomes, not just generate replies
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Every feature is designed to help you move faster while keeping quality and control
                intact.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {featureCards.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-gene-400/30 hover:bg-white/[0.07]"
                >
                  <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                  <p className="mt-4 leading-7 text-slate-300">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/10 bg-white/[0.03] px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <SectionLabel>How it works</SectionLabel>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Go from setup to live support in three simple steps
              </h2>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {steps.map((step) => (
                <article key={step.number} className="rounded-3xl border border-white/10 bg-[#11162a] p-8">
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-gene-300">
                    {step.number}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-4 leading-7 text-slate-300">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="use-cases" className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <SectionLabel>Use cases</SectionLabel>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Flexible enough for support teams, agencies, and growing businesses
              </h2>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {useCases.map((useCase) => (
                <article key={useCase.title} className="rounded-3xl border border-white/10 bg-white/5 p-8">
                  <h3 className="text-xl font-semibold text-white">{useCase.title}</h3>
                  <p className="mt-4 leading-7 text-slate-300">{useCase.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <SectionLabel>Why not just use a generic chatbot?</SectionLabel>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                AiAssist is built for teams that need trust, not just automation
              </h2>
            </div>

            <div className="mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] border-b border-white/10 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-slate-200">
                <div>Capability</div>
                <div className="text-center">AiAssist</div>
                <div className="text-center">Generic AI bot</div>
                <div className="text-center">Manual support</div>
              </div>

              {comparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] items-center border-b border-white/10 px-6 py-4 text-sm text-slate-300 last:border-b-0"
                >
                  <div className="pr-4">{row.label}</div>
                  <div className="flex justify-center">
                    <CheckIcon enabled={row.aiAssist} />
                  </div>
                  <div className="flex justify-center">
                    <CheckIcon enabled={row.generic} />
                  </div>
                  <div className="flex justify-center">
                    <CheckIcon enabled={row.manual} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.03] px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <SectionLabel>Testimonials</SectionLabel>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                What teams would say after switching
              </h2>
              <p className="mt-4 text-sm text-slate-400">
                Illustrative testimonials based on likely customer outcomes.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <figure key={testimonial.name} className="rounded-3xl border border-white/10 bg-[#11162a] p-8">
                  <blockquote className="text-lg leading-8 text-slate-200">
                    “{testimonial.quote}”
                  </blockquote>
                  <figcaption className="mt-6 text-sm text-slate-400">
                    <span className="font-semibold text-white">{testimonial.name}</span>
                    <br />
                    {testimonial.role}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[2rem] border border-gene-400/20 bg-gradient-to-br from-gene-500/15 to-white/5 p-8 shadow-[0_20px_80px_rgba(109,124,255,0.15)] lg:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <SectionLabel>Start small, scale when ready</SectionLabel>
                  <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Try AiAssist free, then upgrade when your team needs more
                  </h2>
                  <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                    Start with 50 AI requests per day for free. No credit card required. When
                    you’re ready, paid plans begin at $19.99/month.
                  </p>
                  <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                    <a
                      href="https://aiassist.net"
                      className="inline-flex items-center justify-center rounded-full bg-gene-500 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-gene-400"
                    >
                      Try AiAssist free
                    </a>
                    <a
                      href="mailto:sales@aiassist.net"
                      className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-base font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                    >
                      Book a demo
                    </a>
                  </div>
                  <p className="mt-4 text-sm text-slate-400">
                    Good fit for SMBs, agencies, and enterprise teams that need more control.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#11162a] p-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gene-300">
                        Early adopter pricing
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold text-white">Simple entry points</h3>
                    </div>
                    <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                      14-day guarantee
                    </div>
                  </div>

                  <div className="mt-8 space-y-4 text-slate-300">
                    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-4">
                      <span>Individual</span>
                      <span className="font-semibold text-white">$19.99/mo</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-4">
                      <span>Small Team (2–10 seats)</span>
                      <span className="font-semibold text-white">$9.99/seat</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-4">
                      <span>Team (11–50 seats)</span>
                      <span className="font-semibold text-white">$7.99/seat</span>
                    </div>
                  </div>

                  <ul className="mt-8 space-y-3 text-sm text-slate-400">
                    <li>• Free tier available forever</li>
                    <li>• Pro and team plans include email support</li>
                    <li>• Enterprise includes white-labeling and dedicated support</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-y border-white/10 bg-white/[0.03] px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <SectionLabel>FAQ</SectionLabel>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Questions teams ask before they launch
              </h2>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {faqs.map((faq) => (
                <article key={faq.question} className="rounded-3xl border border-white/10 bg-[#11162a] p-8">
                  <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                  <p className="mt-4 leading-7 text-slate-300">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="final-cta" className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-gene-500/10 p-10 text-center shadow-2xl backdrop-blur-xl lg:p-14">
            <SectionLabel>Final CTA</SectionLabel>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Give your team faster support without giving up control
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Start free, test with your own knowledge, and decide how much autonomy your assistant
              should have.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="https://aiassist.net"
                className="inline-flex items-center justify-center rounded-full bg-gene-500 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-gene-400"
              >
                Launch your assistant
              </a>
              <a
                href="mailto:sales@aiassist.net"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-base font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
              >
                Talk to sales
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              No credit card required for the free tier.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold text-white">AiAssist</div>
            <div className="mt-1">AI-powered support with human oversight.</div>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
            <a href="https://aiassist.net" className="transition hover:text-white">
              Website
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
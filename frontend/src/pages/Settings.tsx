function Section({
  title,
  envKey,
  description,
  extra,
}: {
  title: string;
  envKey: string | string[];
  description: string;
  extra?: string;
}) {
  const keys = Array.isArray(envKey) ? envKey : [envKey];
  return (
    <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <span className="text-xs bg-slate-100 dark:bg-surface-500 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-surface-400/40 rounded-full px-2.5 py-0.5">
          .env
        </span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{description}</p>
      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-2 bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/40 rounded-lg px-3 py-2">
            <span className="text-xs font-mono text-emerald-400">{k}</span>
            <span className="text-xs text-slate-300 dark:text-slate-600 ml-auto">set in .env file</span>
          </div>
        ))}
      </div>
      {extra && <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">{extra}</p>}
    </div>
  );
}

export default function Settings() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Configure API keys and connections. All secrets are stored in the{" "}
          <code className="bg-slate-50 dark:bg-surface-600 px-1.5 py-0.5 rounded text-sky-400 text-xs">.env</code>{" "}
          file on your server &#8212; never committed to git.
        </p>
      </div>

      <div className="space-y-4">
        <Section
          title="Apollo.io"
          envKey="APOLLO_API_KEY"
          description="Used for lead sourcing. Powers the Lead Finder page to pull verified contacts by industry, role, location, and company size."
          extra="Get your API key from app.apollo.io > Settings > Integrations > API"
        />

        <Section
          title="Mailgun"
          envKey={["MAILGUN_API_KEY", "MAILGUN_DOMAIN"]}
          description="Used for email delivery, open tracking, and click tracking. Required for email campaigns to function."
          extra="Use your Mailgun sending domain (e.g. mg.yourdomain.com). Verify the domain before sending."
        />

        <Section
          title="Claude AI (Anthropic)"
          envKey="ANTHROPIC_API_KEY"
          description="Powers the AI Campaign Wizard and per-step AI content generation in the manual Campaign Builder. Uses claude-sonnet for cost-efficient generation."
          extra="Get your API key from console.anthropic.com"
        />

        <Section
          title="Phantombuster"
          envKey={["PHANTOMBUSTER_API_KEY", "PHANTOMBUSTER_AGENT_ID"]}
          description="Used for LinkedIn automation &#8212; sending connection requests and messages at scale. Requires a Phantombuster account with the LinkedIn Network Booster phantom."
          extra="Configure your phantom agent ID in the Phantombuster dashboard and add it to .env."
        />

        <Section
          title="LinkedIn Account"
          envKey={["LINKEDIN_EMAIL", "LINKEDIN_PASSWORD"]}
          description="Your LinkedIn credentials for browser automation. The session cookie is cached in linkedin_session.json. Delete this file to force a fresh login."
          extra="Use a dedicated LinkedIn account for outreach, not your personal profile."
        />
      </div>

      {/* Safety notice */}
      <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
        <h3 className="font-semibold text-amber-400 text-sm mb-2">
          &#9888; LinkedIn Safety Guidelines
        </h3>
        <ul className="text-sm text-amber-300/80 space-y-1.5">
          <li>&#8226; Stay under 25 connection requests per day during warm-up</li>
          <li>&#8226; Stay under 50 messages per day to avoid restrictions</li>
          <li>&#8226; Use warm-up delays: Phantombuster handles this automatically</li>
          <li>&#8226; Never use your primary personal LinkedIn account</li>
          <li>&#8226; Add randomized delays between actions (Phantombuster setting)</li>
          <li>&#8226; Monitor your LinkedIn account health weekly</li>
        </ul>
      </div>

      {/* Apollo safety notice */}
      <div className="mt-4 bg-sky-500/10 border border-sky-500/30 rounded-xl p-5">
        <h3 className="font-semibold text-sky-400 text-sm mb-2">
          &#8505; Apollo Usage Notes
        </h3>
        <ul className="text-sm text-sky-300/80 space-y-1.5">
          <li>&#8226; Apollo credits are consumed per contact fetched &#8212; use filters to target precisely</li>
          <li>&#8226; Email verification is included in the Apollo fetch</li>
          <li>&#8226; Contacts are deduplicated by email on import</li>
          <li>&#8226; Use the Import Tag field to organize leads by campaign or batch</li>
        </ul>
      </div>
    </div>
  );
}

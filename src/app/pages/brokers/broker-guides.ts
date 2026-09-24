import { BrokerGuide } from './broker-pages';

/**
 * Broker-specific guide content for each `/:lang/brokers/:slug` page, keyed by slug.
 * English source; Arabic lives in `ar.json` under `brokerPages.<slug>` with the same
 * field names (list items by index). Only the lazy-loaded broker page imports this.
 */
export const BROKER_GUIDES: Record<string, BrokerGuide> = {
  alpaca: {
    apiSetup: [
      "The quickest route is the \"Connect with Alpaca\" button on AutoTrader's Exchanges page: sign in to Alpaca, review the requested access and approve it, and AutoTrader receives an OAuth token without you ever handling a secret.",
      "For manual keys, log in to the Alpaca dashboard and first choose whether you are in your paper account or your live account, because each environment has its own separate key pair.",
      "On the dashboard home screen, find the API Keys panel and click Generate New Keys (or Regenerate if keys already exist).",
      "Copy the API Key ID and the Secret Key immediately. Alpaca shows the secret only once, so if you lose it you will need to regenerate, which invalidates the old pair.",
      "Paste the key ID and secret into AutoTrader, marking the connection as paper or live to match the environment the keys came from. Alpaca keys do not have granular permission toggles, so treat them like a password and regenerate them if you ever suspect they have leaked.",
    ],
    feesAndAccounts: "Alpaca does not charge commissions on US-listed stock and ETF trades placed through its API, although small regulatory fees are passed through on sell orders. Crypto trades are priced differently, using a volume-tiered maker/taker fee schedule rather than zero commission, so check Alpaca's fee page for current rates at the time of writing.\n\nThere is no minimum deposit to open a cash account, and paper trading is free and does not require funding a live account at all. Margin accounts need a higher balance, and standard US pattern day trader rules apply to frequent day trading in margin accounts under $25,000, which is worth keeping in mind for fast intraday strategies.",
    availability: "Brokerage services are provided by Alpaca Securities LLC, a FINRA member broker-dealer whose customer securities accounts are covered by SIPC. Crypto trading is offered through a separate Alpaca crypto entity and is not available in every US state. Alpaca also accepts individual accounts from residents of many countries outside the US, though the list of supported countries and the documents required vary, so confirm eligibility during sign-up.",
    strengths: [
      "The paper environment uses the same API as live trading, so a strategy you validate in paper mode behaves the same way when you switch it to your funded account.",
      "Crypto trades around the clock on Alpaca, which lets a server-side AutoTrader strategy keep working nights and weekends when the stock market is closed.",
      "OAuth support means you can connect without copying secrets, and you can revoke AutoTrader's access from your Alpaca account at any time.",
      "Commission-free stock and ETF orders make it practical to run strategies that trade frequently with modest position sizes.",
    ],
    limitations: [
      "Alpaca focuses on US-listed securities, so there is no access to non-US exchanges for stocks.",
      "Manual API keys carry full account access with no read-only or trade-only scopes, so key hygiene matters more than on brokers with permission toggles.",
      "Stock market orders only fill during market hours; a signal generated overnight on a stock will wait for the next session, and the opening price can differ from the signal price.",
    ],
    strategies: [
      { slug: "momentum-trading", reason: "Alpaca's broad universe of liquid US stocks and ETFs gives a momentum strategy plenty of instruments to rotate through without paying per-trade commissions." },
      { slug: "dollar-cost-averaging", reason: "Scheduled, fixed-amount buys of ETFs or crypto fit Alpaca well because small recurring orders are not eaten up by stock commissions." },
      { slug: "vwap-indicator", reason: "VWAP-based entries suit intraday trading in high-volume US equities, which is where Alpaca's order flow is concentrated." },
    ],
    faqs: [
      {
        question: "Is Alpaca paper trading really free?",
        answer: "Yes. Any Alpaca account gets a paper trading environment with simulated funds at no cost, and you do not need to deposit money to use it. It has its own API keys, so in AutoTrader you add it as a separate paper connection. Fills in paper are simulated, so live results can still differ slightly because of real-world liquidity and slippage.",
      },
      {
        question: "Should I use OAuth or API keys to connect Alpaca?",
        answer: "OAuth is usually the better choice. You approve AutoTrader from inside Alpaca, no secret is copied around, and you can revoke access from your Alpaca account whenever you like. Manual API keys work just as well for placing orders but grant full account access, so store them carefully and regenerate them if they are ever exposed.",
      },
      {
        question: "Can AutoTrader trade crypto on Alpaca on weekends?",
        answer: "Yes, if crypto trading is enabled on your Alpaca account and available in your state. Crypto markets on Alpaca run 24/7, and because AutoTrader strategies run server-side, a crypto strategy keeps evaluating signals and placing market orders at any hour. Stock and ETF strategies, by contrast, only get fills during US market sessions.",
      },
      {
        question: "Does the pattern day trader rule affect automated strategies on Alpaca?",
        answer: "It can. US rules limit margin accounts with less than $25,000 in equity to a small number of day trades within a rolling five-business-day window. A strategy that opens and closes stock positions on the same day may hit this limit, so consider swing-style holding periods, a cash account, or crypto pairs if your balance is below the threshold.",
      },
    ],
  },
  "interactive-brokers": {
    apiSetup: [
      "Install either IB Gateway (lighter, designed for API connections) or Trader Workstation from Interactive Brokers, and log in with the username for the account you want to automate. Paper accounts have their own separate username.",
      "In the API settings (in TWS under Global Configuration, then API, then Settings), enable \"Enable ActiveX and Socket Clients\" and untick \"Read-Only API\", otherwise orders will be rejected.",
      "Note the socket port shown in the same settings screen. By default TWS uses 7497 for paper and 7496 for live, while IB Gateway uses 4002 for paper and 4001 for live.",
      "Restrict incoming connections with the Trusted IPs list so only the machine or address AutoTrader connects from can reach the API socket.",
      "Enter the connection details on AutoTrader's Exchanges page and keep the gateway running. Interactive Brokers requires periodic re-authentication, including a regular full login with two-factor confirmation, so plan to check the gateway at least weekly.",
      "Make sure your account has the trading permissions and market data subscriptions needed for the instruments your strategy trades, since the API cannot trade or price anything the account itself is not set up for.",
    ],
    feesAndAccounts: "Interactive Brokers offers two pricing plans. IBKR Lite, available to US clients, offers commission-free trades on US-listed stocks and ETFs. IBKR Pro charges low per-share commissions on either a fixed or a tiered schedule, where tiered rates fall as monthly volume rises and exchange and regulatory fees are passed through. Check the IBKR pricing pages for current rates at the time of writing.\n\nReal-time market data for API use generally requires paid exchange data subscriptions, which are billed separately from commissions. IBKR no longer requires a minimum deposit for most individual accounts, and a paper trading account can be created from the Client Portal settings once your live account is open.",
    availability: "Interactive Brokers serves clients in a large number of countries through regulated local entities. In the US it is regulated by the SEC and FINRA, and by the CFTC and NFA for futures; other group entities are overseen by regulators such as the UK's FCA and the Central Bank of Ireland. Which entity holds your account, and which products you can trade, depends on your country of residence, and some jurisdictions are not accepted at all.",
    strengths: [
      "A single account reaches stock exchanges across North America, Europe and Asia, so one AutoTrader connection can run strategies on markets that most retail brokers do not offer.",
      "The paper account mirrors live account behavior closely and uses the same API, giving you a realistic rehearsal before committing capital.",
      "Tiered commissions reward high-volume strategies, as per-share costs drop as your monthly activity grows.",
      "IBKR has offered API access to retail clients for many years, and its order routing and account infrastructure are built for heavy programmatic use.",
    ],
    limitations: [
      "The IB API requires IB Gateway or TWS to be running and logged in; if the gateway restarts, loses connection or needs a fresh two-factor login, AutoTrader cannot place orders until it is back online.",
      "Market data subscriptions cost extra, and without the right subscription your strategy may receive delayed or no prices for some exchanges.",
      "Trading permissions are granular by product and region, so an order can be rejected simply because the account is not approved for that market.",
    ],
    strategies: [
      { slug: "trend-following", reason: "Access to stock markets on several continents lets a trend-following strategy diversify across regions whose trends are often unrelated." },
      { slug: "rebalancing-strategy", reason: "Periodically rebalancing a multi-market ETF portfolio suits IBKR's global reach and low per-share costs." },
      { slug: "position-trading", reason: "Longer holding periods reduce how often the strategy depends on the gateway being online at a precise moment, which fits IBKR's session-based connection." },
    ],
    faqs: [
      {
        question: "Why does AutoTrader need IB Gateway or TWS for Interactive Brokers?",
        answer: "The official IB API is designed to talk to a running copy of IB Gateway or Trader Workstation rather than directly to IBKR's servers. The gateway handles your login and two-factor authentication and relays orders to Interactive Brokers. AutoTrader sends its market orders through that session, so the gateway needs to stay running and logged in for your strategies to trade.",
      },
      {
        question: "How do I create an IBKR paper trading account?",
        answer: "Once your live account is approved, open the Client Portal settings and look for the paper trading account option. IBKR creates a separate paper username with simulated funds. Log in to IB Gateway or TWS with that username, use the paper port, and connect it to AutoTrader as a paper connection to test strategies with no real money at risk.",
      },
      {
        question: "Does IBKR Lite work with automated trading?",
        answer: "IBKR Lite provides commission-free US stock and ETF trades for US clients, but its order routing and feature set differ from IBKR Pro, and some API-oriented traders prefer Pro for its routing and tiered pricing. Check IBKR's current plan comparison before choosing, and remember you can usually switch plans later from the account settings.",
      },
      {
        question: "Why was my order rejected when connecting AutoTrader to IBKR?",
        answer: "The most common causes are the \"Read-Only API\" setting still being enabled, the account lacking trading permission for that product or exchange, missing market data, or the gateway session having expired. Check the API settings in TWS or IB Gateway first, then review trading permissions in the Client Portal.",
      },
    ],
  },
  tradier: {
    apiSetup: [
      "Log in to your Tradier brokerage account and open the API access section of your account settings, where Tradier lists your production access token.",
      "Generate or copy the production access token. It acts as a bearer token for the whole account, so store it somewhere safe and never share it publicly.",
      "Find your Tradier account number in the account overview; AutoTrader needs it to route orders to the correct account.",
      "For paper testing, register for Tradier's developer sandbox, which issues a separate sandbox token and sandbox account number that only work against the simulated environment.",
      "On AutoTrader's Exchanges page, paste the access token as the API key and the account number as the secret, choosing paper for sandbox credentials and live for production credentials.",
    ],
    feesAndAccounts: "Tradier's pricing is plan-based. Stock and ETF trades are commission-free, while options are charged per contract on the basic plan; Tradier also offers monthly subscription plans that remove most per-contract options commissions for active traders. Because AutoTrader trades stocks and ETFs, the subscription mainly matters if you also trade options manually in the same account. Plan names and prices change, so check Tradier's pricing page for current rates at the time of writing.\n\nTradier offers individual, joint, IRA and entity accounts. The sandbox is free to use and does not require a funded account, which makes it easy to trial strategies before opening or funding a live account.",
    availability: "Tradier Brokerage is a US broker-dealer and a member of FINRA and SIPC. Its service is aimed mainly at US residents, and while some non-US applicants have been accepted, international availability is limited and depends on country and documentation. If you live outside the US, confirm eligibility with Tradier before relying on it for automated trading, and remember that it offers access to US markets only.",
    strengths: [
      "Tradier was built as an API platform first, so programmatic order placement is a core use case rather than an add-on to a desktop app.",
      "Token-based authentication is simple: one access token plus an account number, with no gateway software to keep running.",
      "The free sandbox lets you run a strategy end to end against a simulated account before any real money is involved.",
      "Commission-free stock and ETF trades keep costs predictable for strategies that trade regularly.",
    ],
    limitations: [
      "The sandbox uses delayed market data, so paper fills can differ from what a live strategy would get, especially for fast intraday signals.",
      "Access tokens are not scoped to trading only; anyone holding the token can act on the account, so rotate it if it may have been exposed.",
      "Tradier covers US markets only, with no access to non-US exchanges.",
    ],
    strategies: [
      { slug: "swing-trading", reason: "Holding US stocks for days rather than minutes suits Tradier well, and makes the sandbox's delayed data less of a problem when testing." },
      { slug: "mean-reversion", reason: "Liquid large-cap US stocks and ETFs, which make up much of Tradier's order flow, tend to revert after short-term overreactions." },
      { slug: "rsi-indicator", reason: "RSI-based entries on daily or hourly bars are easy to validate in the Tradier sandbox before running them live." },
    ],
    faqs: [
      {
        question: "Where do I find my Tradier API access token?",
        answer: "Log in to your Tradier account and open the API access area of the settings, where your production token is shown or can be generated. Sandbox tokens come from a separate developer sandbox registration. In AutoTrader, paste the token as the API key and your Tradier account number as the secret.",
      },
      {
        question: "Is the Tradier sandbox the same as live trading?",
        answer: "It uses the same API format, so a strategy that works in the sandbox will send the same orders in production. The main differences are that sandbox market data is delayed and fills are simulated, so prices and execution may not match a live account. Treat the sandbox as a check that the strategy's logic is correct, not as a precise forecast of live results.",
      },
      {
        question: "Do I need a Tradier subscription plan to use AutoTrader?",
        answer: "No. AutoTrader trades US stocks and ETFs, which are commission-free on Tradier's standard pricing. The subscription plans mainly reduce options commissions, so they matter only if you also trade options manually in the same account. Check Tradier's current pricing, since plan details change from time to time.",
      },
      {
        question: "Can AutoTrader trade options on Tradier?",
        answer: "No. Although Tradier is well known for options, AutoTrader places market orders for stocks and ETFs only. You can still trade options manually in the same Tradier account, but keep in mind that AutoTrader's position sizing only knows about the stock and ETF orders it placed itself.",
      },
    ],
  },
  tastytrade: {
    apiSetup: [
      "Make sure your tastytrade account is fully open and funded, and note the account number shown in the account selector of the tastytrade platform.",
      "Review the API access terms in your tastytrade account settings; tastytrade requires customers to accept its API agreement before third-party tools can trade the account.",
      "Because AutoTrader signs in with your tastytrade login email and password, consider how two-factor authentication is configured on your account, as some login challenges may need your attention when the session is created.",
      "On AutoTrader's Exchanges page, enter your login email as the API key, your password as the secret and your account number as the passphrase.",
      "If you use tastytrade's sandbox (certification) environment, create a separate sandbox login and add it to AutoTrader as a paper connection; sandbox credentials do not work on the live system.",
    ],
    feesAndAccounts: "tastytrade does not charge commissions on stock and ETF trades, which covers everything AutoTrader places on the account, although regulatory and clearing fees can still apply. It is better known for its derivatives pricing: at the time of writing, equity options cost a flat fee per contract to open with a cap per leg and nothing to close, and futures carry a per-contract commission. Check tastytrade's pricing page for current rates.\n\nThere is no minimum deposit for a cash account, while margin accounts require a higher balance under standard US rules. tastytrade offers individual, joint, IRA and entity accounts, and one login can hold several accounts, which is why AutoTrader asks for the specific account number.",
    availability: "In the US, tastytrade, Inc. is a FINRA-registered broker-dealer and SIPC member, and futures activity falls under CFTC and NFA oversight. It also accepts clients from many countries outside the US, and has expanded internationally through local entities in some regions. Eligibility, the products offered and the regulator involved all depend on your country of residence, so confirm availability during the application.",
    strengths: [
      "Commission-free stock and ETF trades mean AutoTrader's market orders are not burdened by per-trade charges.",
      "One login can hold several accounts, so you can dedicate a separate account to automation and keep it apart from your manual options trading.",
      "tastytrade's platform shows positions opened by AutoTrader alongside your other activity, making it easy to monitor what a strategy is doing.",
      "A dedicated sandbox environment exists for testing API-based trading without risking real funds.",
    ],
    limitations: [
      "The connection uses your account password rather than a limited-scope API key, so a password change will disconnect AutoTrader until you update the credentials.",
      "Much of tastytrade's appeal is options and futures, neither of which AutoTrader trades; if you only want automated stock trading, the options-focused pricing advantage does not apply.",
      "Two-factor or device verification prompts can interrupt a session, so check the connection status in AutoTrader after changing your security settings.",
    ],
    strategies: [
      { slug: "breakout-strategy", reason: "Active tastytrade traders often follow volatile, high-volume US stocks where breakouts from ranges are frequent and liquidity supports market orders." },
      { slug: "bollinger-bands", reason: "Bollinger Bands measure volatility expansion and contraction, the same concept tastytrade's options-oriented community watches closely, applied here to stock and ETF entries." },
      { slug: "moving-average-crossover", reason: "A simple crossover on liquid ETFs is a sensible first automated strategy for an account that has mostly been used for manual derivatives trading." },
    ],
    faqs: [
      {
        question: "Why does AutoTrader ask for my tastytrade password?",
        answer: "The tastytrade connection authenticates with your login email and password to create an API session, plus your account number to route orders to the correct account. AutoTrader uses the session only to place and monitor stock and ETF orders. If you change your password, update it on the Exchanges page so strategies keep running.",
      },
      {
        question: "Can AutoTrader trade options or futures on tastytrade?",
        answer: "No. Even though tastytrade is best known for options and futures, AutoTrader places market orders for US stocks and ETFs only. You can keep trading derivatives manually, and if you want a clean separation, open a second tastytrade account under the same login and use it only for automation.",
      },
      {
        question: "Does tastytrade have a paper trading or sandbox account?",
        answer: "tastytrade provides a sandbox environment intended for testing API integrations, with its own credentials separate from your live login. Where available, you can add those sandbox credentials to AutoTrader as a paper connection. The sandbox is for checking strategy behavior, and its simulated fills will not exactly match live market execution.",
      },
      {
        question: "What does it cost to run an automated stock strategy on tastytrade?",
        answer: "Stock and ETF trades on tastytrade are commission-free at the time of writing, so the main costs are small regulatory fees and the spread you pay on each market order. The capped per-contract options commissions tastytrade is known for do not apply, because AutoTrader does not trade options. Check tastytrade's pricing page for the latest details.",
      },
    ],
  },
  schwab: {
    apiSetup: [
      "Sign in to the Schwab Developer Portal with a login separate from your brokerage credentials, and register as an individual trader so you can create apps for your own accounts.",
      "Create a new app, select the Accounts and Trading Production API product, and enter a callback URL. New apps are reviewed by Schwab and can take a few business days to reach Ready For Use status.",
      "Once the app is approved, copy its App Key. AutoTrader uses it as the passphrase field on the Exchanges page.",
      "Complete Schwab's OAuth authorization, logging in with your Schwab brokerage credentials and choosing which linked accounts the app may access, to receive an access token.",
      "On the AutoTrader Exchanges page, paste the access token as the API key and your Schwab account number as the secret, then confirm the connection shows your balance.",
      "Plan to re-authorize regularly: Schwab access tokens are short-lived and refresh tokens expire after a number of days, so a connection that goes quiet will need a fresh OAuth login.",
    ],
    feesAndAccounts: "Schwab charges no commission on online trades of US-listed stocks and ETFs, which suits strategies that rebalance or trade frequently in equities. Options carry a per-contract fee, and broker-assisted or phone trades cost more, but neither applies to AutoTrader's stock and ETF market orders. Regulatory transaction fees on sales still apply, as they do at every US broker. Check Schwab's pricing page for current rates.\n\nA standard Schwab brokerage account has no account minimum, and the Trader API works with individual brokerage accounts linked to your developer app. Retirement accounts such as IRAs can also be linked, although trading rules for those account types still apply.",
    availability: "Charles Schwab & Co. is a US broker-dealer registered with the SEC, a member of FINRA and SIPC, and part of the publicly traded Charles Schwab Corporation. The Trader API and standard brokerage accounts are aimed primarily at US residents. Schwab does offer accounts to some non-US residents through its international services, but eligibility depends on country, and non-US clients should confirm with Schwab whether API access is available for their account type before planning an automated setup.",
    strengths: [
      "Commission-free online stock and ETF trades mean frequent rebalancing or signal-driven entries do not accumulate per-order commissions.",
      "The Trader API is an official, documented interface from a large US broker, so automated orders go through the same infrastructure as orders placed in thinkorswim or on schwab.com.",
      "Schwab's broad catalog of US-listed stocks and ETFs makes it practical to automate diversified portfolios, sector rotation or index-tracking strategies.",
      "Keeping an automated strategy inside a long-term Schwab account lets you run it alongside existing holdings without moving assets to a separate broker.",
    ],
    limitations: [
      "OAuth tokens expire and refresh tokens must be renewed through a manual login on a regular cycle, so a Schwab connection needs periodic attention to keep a 24/7 strategy running.",
      "paperMoney lives inside thinkorswim rather than behind the Trader API, so it is useful for rehearsing a strategy by hand but is not a drop-in simulated endpoint for automated orders.",
      "US stock orders only fill during market hours, so signals generated overnight or on weekends are executed at or after the next session's open, which can differ from the signal price.",
    ],
    strategies: [
      { slug: "trend-following", reason: "Liquid US large caps and index ETFs trend over weeks and months, and commission-free trades keep the cost of frequent trend adjustments low." },
      { slug: "swing-trading", reason: "Multi-day holds fit Schwab's regular-hours equity market and are less sensitive to the gap between an overnight signal and the next open." },
      { slug: "rebalancing-strategy", reason: "Schwab's broad ETF lineup and zero online commissions make periodic rebalancing of a multi-ETF portfolio inexpensive to automate." },
    ],
    faqs: [
      {
        question: "Does Schwab allow automated trading through its API?",
        answer: "Yes. Schwab publishes the Trader API on its developer portal specifically so individual clients and apps can place orders programmatically in their own accounts. You register an app, wait for Schwab to approve it, and authorize it with OAuth. AutoTrader then uses that authorization to send stock and ETF market orders on your behalf, subject to Schwab's usual account rules and API throttling.",
      },
      {
        question: "Why does my Schwab connection need to be renewed?",
        answer: "Schwab's OAuth design uses short-lived access tokens and a refresh token that also expires after a limited number of days. When the refresh token lapses, the app can no longer trade until you log in to Schwab again and re-authorize it. If a strategy stops placing orders, check the connection on the AutoTrader Exchanges page and repeat the OAuth step.",
      },
      {
        question: "Did the TD Ameritrade API move to Schwab?",
        answer: "Yes. After Schwab completed its acquisition of TD Ameritrade, the old TD Ameritrade developer API was retired and replaced by the Schwab Trader API on Schwab's own developer portal. Existing TD Ameritrade apps and keys do not carry over, so you need to register a new app with Schwab and obtain a new App Key before connecting AutoTrader.",
      },
      {
        question: "What does it cost to run an AutoTrader strategy on Schwab?",
        answer: "On the Schwab side, online trades of US-listed stocks and ETFs are commission-free, and there is no account minimum for a standard brokerage account. Small regulatory fees apply to sell orders, and ETFs carry their own expense ratios. Always check Schwab's current pricing page, since fee schedules can change, and factor in the spread you pay on each market order.",
      },
    ],
  },
  "ig-markets": {
    apiSetup: [
      "Log in to the IG web platform, open My IG, and go to Settings, then the API keys section.",
      "Create a new API key and give it a name you will recognize. Keys are tied to the environment they are created in, so generate a key from your demo account for paper testing and a separate one from your live account.",
      "Note your IG username, which is the login identifier and not necessarily your email address. AutoTrader uses it as the passphrase field.",
      "On the AutoTrader Exchanges page, paste the API key, enter your IG account password as the secret and your username as the passphrase, and select demo or live to match the key.",
      "If you hold several IG accounts, such as a CFD account and a spread betting account, confirm which one is set as default, since orders are placed in the active account for that login.",
      "Rotate or disable the key from the same API keys screen if you stop using AutoTrader or change your IG password.",
    ],
    feesAndAccounts: "IG's pricing on forex, indices and commodities is built mainly into the spread, with no separate commission on those markets. Share CFDs typically carry a commission based on the trade value instead of a widened spread. Positions held past the daily cutoff incur overnight funding charges, and guaranteed stops add a premium when triggered. Check IG's charges page for current spreads and rates, as they vary by market and trading hours.\n\nIG offers CFD accounts and, in the UK and Ireland, spread betting accounts, each with a free demo counterpart that the REST Trading API can connect to. Every market has its own minimum deal size, so a strategy's investment amount should be large enough to meet the minimum for the instruments it trades.",
    availability: "IG Group is listed on the London Stock Exchange, and its UK entity is authorized and regulated by the Financial Conduct Authority. Clients in the European Economic Area are generally served by IG Europe, regulated in Germany by BaFin, and IG also holds licenses in Australia, Singapore and other markets. Spread betting is limited to the UK and Ireland. IG does not offer CFDs to US residents; in the US, IG Group operates a separate forex offering and owns tastytrade. Retail CFD accounts are subject to local leverage limits and negative balance protection rules.",
    strengths: [
      "A single REST Trading API covers thousands of markets, so one connection lets a strategy trade forex majors, stock indices, commodities and shares.",
      "Separate demo API keys give a realistic simulated environment on the same market list and price feed, which makes testing a strategy before going live straightforward.",
      "Many IG index and forex markets trade almost around the clock on weekdays, and some weekend markets exist, which suits strategies that run server-side 24/7.",
      "Long operating history and FCA supervision mean the API has been used by algorithmic traders for years and is well understood.",
    ],
    limitations: [
      "CFDs and spread bets are leveraged products, and overnight funding charges can erode returns on strategies that hold positions for weeks.",
      "IG enforces API usage allowances, including limits on historical price data requests, so very high-frequency strategies across many markets may hit throttling.",
      "Minimum deal sizes and contract sizes differ by market and account type, so an amount that works on one instrument may be rejected on another.",
    ],
    strategies: [
      { slug: "range-trading", reason: "Major forex pairs such as EUR/USD often spend long stretches in ranges during quieter sessions, and IG's spread-only pricing keeps entry costs predictable." },
      { slug: "breakout-strategy", reason: "Stock indices like the FTSE 100 or Germany 40 often break out around their cash-market opens, a pattern a server-side strategy can catch without watching the screen." },
      { slug: "pivot-points", reason: "Daily pivot levels are widely followed on forex and index CFDs, giving clear, rule-based levels for automated entries and exits on IG's markets." },
    ],
    faqs: [
      {
        question: "Does IG allow automated trading?",
        answer: "Yes. IG provides the REST Trading API and a streaming API specifically for algorithmic and third-party trading, documented on its developer portal. You create an API key from your account settings, and a tool like AutoTrader can then open and close positions on your behalf. Usage allowances apply, and you remain responsible for all positions opened through the API.",
      },
      {
        question: "Can I test an IG strategy on a demo account?",
        answer: "Yes. IG demo accounts are free and come with virtual funds on the same markets as live accounts. To use one with AutoTrader, create the API key while logged in to the demo account, because demo and live keys are not interchangeable. Keep in mind that demo fills do not reflect slippage during fast markets exactly.",
      },
      {
        question: "Should I use a CFD or spread betting account with AutoTrader?",
        answer: "Both account types are reachable through the IG API, and the strategy logic is the same. Spread betting is only available in the UK and Ireland and has different tax treatment than CFDs, which depends on your personal circumstances. Pick the account type that fits your tax situation, then make sure it is the default account for the login you connect.",
      },
      {
        question: "Which IG login details does AutoTrader need?",
        answer: "AutoTrader needs three items: the API key you generate in My IG settings, your IG account password, and your IG username. The username is the identifier you log in with, which can differ from your email address. Entering the demo key with live credentials, or the reverse, is the most common reason a connection fails.",
      },
    ],
  },
  binance: {
    apiSetup: [
      "Log in to Binance, open your profile menu, and choose API Management. Your account must have completed identity verification and have two-factor authentication enabled.",
      "Click Create API, choose a System generated key, give it a label such as AutoTrader, and confirm with your security verification.",
      "Copy the API key and secret key immediately. The secret is shown only once, so a lost secret means deleting the key and creating a new one.",
      "Click Edit restrictions, keep Enable Reading on, and turn on Enable Spot & Margin Trading. Leave Enable Withdrawals, universal transfer and futures permissions off.",
      "Optionally restrict access to trusted IPs if AutoTrader provides server addresses for whitelisting, since Binance can apply extra limits to trading keys without an IP restriction.",
      "Paste the key and secret on the AutoTrader Exchanges page and confirm that your spot balances load before enabling a strategy.",
    ],
    feesAndAccounts: "Binance charges spot fees on a maker/taker schedule, with base spot fees around 0.1% for both at the time of writing. Paying fees in BNB gives a discount, and VIP tiers based on 30-day trading volume and BNB holdings lower rates further. Because AutoTrader places market orders, trades are normally charged the taker rate. Check Binance's fee page for current rates and any zero-fee promotions on specific pairs.\n\nThere is no account minimum, but each trading pair has its own minimum order value and quantity step size. A strategy's investment amount needs to clear those filters, especially on lower-priced altcoins or when a position is split into several orders.",
    availability: "Binance does not serve US residents, who use the separate Binance.US platform, and it withdrew from Canada and several other markets in 2023. Availability of individual products varies by country, and UK users face restrictions on some services. Binance holds registrations or licenses in a number of jurisdictions, including several EU member states and Dubai, but it is not regulated as a single entity everywhere it operates. Identity verification is required before trading, and users should confirm that Binance is permitted in their country of residence.",
    strengths: [
      "Deep liquidity on major spot pairs such as BTC/USDT and ETH/USDT keeps slippage low for market orders, which is what AutoTrader uses.",
      "Binance offers a public spot testnet with test balances, useful for checking that a key and strategy behave as expected before trading real funds.",
      "A very large list of spot pairs lets a strategy trade majors and a broad set of altcoins from a single connection and one balance.",
      "The spot API is mature, widely used by trading bots, and exposes granular key permissions, so a key can trade without ever being able to withdraw.",
    ],
    limitations: [
      "Binance's weight-based API rate limits and per-pair order filters mean strategies that trade many small orders across many pairs can see rejected or throttled requests.",
      "Regional restrictions change over time, and an account opened in one country may lose access to products if Binance exits that market.",
      "The testnet has its own separate keys and thinner, simulated liquidity, so fills there are only a rough guide to live execution.",
    ],
    strategies: [
      { slug: "grid-trading", reason: "Liquid pairs like BTC/USDT oscillate frequently within ranges, and Binance's low base fees keep the cost of repeated buy and sell levels manageable." },
      { slug: "momentum-trading", reason: "Binance's wide altcoin selection produces regular sharp momentum moves, and deep order books let a strategy enter and exit them with limited slippage." },
      { slug: "dollar-cost-averaging", reason: "Scheduled spot buys of BTC, ETH or BNB suit Binance's low fees and small minimum order sizes on major pairs." },
    ],
    faqs: [
      {
        question: "Is trading bot use allowed on Binance?",
        answer: "Yes. Binance publishes a public spot API and lets users create API keys with trading permission for exactly this purpose. Automated trading through third-party tools is permitted as long as you follow Binance's terms and API rate limits. You remain responsible for the key, so grant only the permissions AutoTrader needs and never enable withdrawals.",
      },
      {
        question: "Which Binance API permissions does AutoTrader need?",
        answer: "Keep Enable Reading on and turn on Enable Spot & Margin Trading. That is enough for AutoTrader to read balances and place spot market orders. Leave Enable Withdrawals, universal transfer and futures permissions switched off. AutoTrader only trades spot on Binance, so margin is not used even though Binance groups the spot and margin permission under one toggle.",
      },
      {
        question: "Does Binance have a testnet for trying strategies?",
        answer: "Yes. Binance runs a spot testnet with free test balances and its own API keys, separate from your main account. It is useful for confirming that orders are formed correctly and that a strategy triggers as expected. Testnet prices and liquidity do not always match the live market, so treat results there as a functional check rather than a performance forecast.",
      },
      {
        question: "Can I use AutoTrader with Binance from the United States?",
        answer: "No. Binance.com does not accept US residents, and US users are directed to Binance.US, which is a separate company with its own accounts, keys and API. AutoTrader's Binance connection is for Binance.com accounts. If you are in the US, choose one of the US-available exchanges supported on the Exchanges page instead.",
      },
    ],
  },
  coinbase: {
    apiSetup: [
      "Sign in to Coinbase, open Coinbase Advanced, and go to the API section of your settings, which creates keys through the Coinbase Developer Platform.",
      "Create a new API key, select the portfolio it should apply to, and give it a nickname you will recognize later.",
      "Grant the View and Trade permissions only. Leave the Transfer permission off so the key cannot send funds out of your account.",
      "Optionally add an IP allowlist if AutoTrader provides server addresses, then complete the two-step verification Coinbase requests.",
      "Download or copy the key details straight away, since the private key is only shown once. Paste them into the matching key, secret and passphrase fields on the AutoTrader Exchanges page.",
      "Confirm your USD or USDC balance appears in AutoTrader before starting a strategy, which verifies that the key points at the right portfolio.",
    ],
    feesAndAccounts: "Coinbase Advanced uses a tiered maker/taker fee schedule based on your trailing 30-day trading volume, with the lowest tier charging noticeably more than large offshore exchanges; at the time of writing the entry-level taker fee is around 0.6%. Because AutoTrader places market orders, taker rates apply. Stablecoin pairs have their own lower fee schedule. Check Coinbase's fee page for current tiers.\n\nThere is no minimum balance for an Advanced account, but each product has a minimum order size. Coinbase supports multiple portfolios within one login, and each API key is scoped to a portfolio, so a separate portfolio is a clean way to ring-fence funds for automated strategies.",
    availability: "Coinbase Global is listed on Nasdaq and operates under US regulation, including state money transmitter licenses and a New York BitLicense, so it is available in nearly all US states. It is registered with the FCA in the UK and is authorized under the EU's MiCA framework to serve European Economic Area customers. The list of tradable assets differs by country, and some tokens available in one region are not offered in another. Identity verification is required before trading.",
    strengths: [
      "Strong US regulatory standing and public-company reporting make Coinbase a common choice for traders who want automated strategies at a heavily supervised exchange.",
      "Granular key permissions and portfolio-scoped keys let you isolate the funds a strategy can trade and rule out transfers entirely.",
      "Direct USD bank deposits and USD-quoted pairs such as BTC-USD and ETH-USD mean profits and losses are measured in dollars without a stablecoin step.",
      "Coinbase's order books on major USD pairs are liquid, which helps market orders fill close to the quoted price.",
    ],
    limitations: [
      "Taker fees at lower volume tiers are higher than on many global exchanges, so strategies that trade very frequently can see fees absorb a large share of returns.",
      "Coinbase does not offer a full paper-trading environment for Advanced spot accounts, so testing usually means starting live with a small investment amount.",
      "The asset list is narrower than on offshore altcoin-focused exchanges and varies by region, which limits strategies that rely on newly listed tokens.",
    ],
    strategies: [
      { slug: "dollar-cost-averaging", reason: "Recurring USD buys of BTC or ETH fit Coinbase's US banking links and suit investors who value a regulated venue over the lowest fees." },
      { slug: "moving-average-crossover", reason: "A slower crossover on BTC-USD or ETH-USD trades infrequently, which keeps Coinbase's taker fees from dominating results." },
      { slug: "rebalancing-strategy", reason: "Periodically rebalancing a basket of major USD pairs works well within a dedicated Coinbase portfolio scoped to a single API key." },
    ],
    faqs: [
      {
        question: "Can I run a trading bot on Coinbase Advanced?",
        answer: "Yes. Coinbase provides the Advanced Trade API and lets you create API keys with trade permission through the Coinbase Developer Platform. Third-party tools like AutoTrader can use those keys to place orders in your account. Coinbase applies rate limits to API requests, and you are responsible for any orders placed with your key, so grant only View and Trade.",
      },
      {
        question: "Which Coinbase API key permissions should I grant?",
        answer: "Grant View so AutoTrader can read balances and order status, and Trade so it can place market orders. Do not grant Transfer, which would allow moving funds out of the account. You can also scope the key to a specific portfolio, which limits AutoTrader to the funds in that portfolio and leaves the rest of your Coinbase holdings untouched.",
      },
      {
        question: "Does Coinbase have a sandbox or testnet?",
        answer: "Coinbase does not provide a full simulated trading environment for Advanced spot accounts with realistic fills, unlike some exchanges with testnets. The practical approach is to backtest or review the strategy's rules first, then go live on Coinbase with a small investment amount in a dedicated portfolio and scale up once the strategy behaves as expected.",
      },
      {
        question: "Are Coinbase Advanced fees high for automated trading?",
        answer: "They depend on your 30-day volume tier. At low volume, Coinbase's taker fees are higher than many global exchanges, and AutoTrader's market orders pay the taker rate. Lower-frequency strategies such as swing or trend approaches are less affected than scalping. Check Coinbase's fee schedule for current tiers, and consider stablecoin pairs, which have a separate, lower fee schedule.",
      },
    ],
  },
  kraken: {
    apiSetup: [
      "Log in to Kraken, open the account menu and go to Settings, then the API section, and choose to create a new API key.",
      "Give the key a description such as AutoTrader so you can identify it later if you run several keys.",
      "Enable the query permissions (funds, open orders and trades, closed orders and trades) plus the order permissions to create, modify and cancel orders. Leave Withdraw Funds and any funding or earn permissions switched off.",
      "Optionally restrict the key to specific IP addresses and set an expiry date; leave the nonce window at its default unless you have a reason to change it.",
      "Generate the key and copy both the API key and the private key immediately, because Kraken only shows the private key once.",
      "On AutoTrader's Exchanges page, paste the API key and the private key into the Kraken fields, save, and confirm your balances load before enabling a strategy.",
    ],
    feesAndAccounts: "Kraken Pro, which is where API orders are priced, uses a maker-taker schedule that steps down as your trailing 30-day trading volume rises. At the time of writing the entry tier is roughly 0.25% maker and 0.40% taker, and because AutoTrader places market orders, you should budget for taker fees on every fill. Stablecoin and some fiat-to-fiat pairs have their own lower schedule. Check Kraken's fee page for current rates.\n\nThere is no large account minimum, but each pair has a minimum order size, so very small investment amounts may be rejected. Your verification level also matters: higher levels raise funding limits and give API clients a larger rate-limit allowance, which helps if you run several strategies at once.",
    availability: "Kraken serves customers in most of the United States, although a small number of states are excluded, and it operates across Canada, the UK, the European Union and Australia among other regions. It is registered with FinCEN in the US and FINTRAC in Canada, is registered with the FCA in the UK, and holds a MiCA authorization for the EU through its Irish entity. Product availability, especially margin and futures, differs by country, so confirm what your residence allows before you start.",
    strengths: [
      "Fiat pairs in USD, EUR, GBP, CAD and other currencies let a strategy trade directly against your local currency instead of routing through a stablecoin.",
      "The API is long-established and stable, with a transparent counter-based rate limit tied to your verification level, which makes the load from automated order flow predictable.",
      "Granular API permissions and optional IP restriction and key expiry let you issue a key that can trade but can never move funds off the exchange.",
      "Kraken's long operating history and conservative approach to listings mean the pairs available tend to be established assets with consistent liquidity.",
    ],
    limitations: [
      "Kraken does not offer a public sandbox for spot trading, so paper-test your strategy in AutoTrader's simulated mode rather than against a Kraken testnet.",
      "Entry-level taker fees are higher than on some offshore exchanges, which eats into the edge of high-frequency strategies that trade many small moves.",
      "The API uses legacy asset codes such as XBT for bitcoin, and pair names like XXBTZUSD, so symbols in Kraken's own reports may look different from those in AutoTrader.",
    ],
    strategies: [
      { slug: "dollar-cost-averaging", reason: "Kraken's direct fiat on-ramps and USD and EUR pairs suit scheduled, recurring buys of major coins without converting to stablecoins first." },
      { slug: "trend-following", reason: "Fewer, larger trades help offset Kraken's taker fees, and its liquid BTC and ETH fiat pairs trend well on daily and four-hour charts." },
      { slug: "swing-trading", reason: "Holding positions for days keeps the trade count low relative to the move captured, which fits Kraken's fee structure." },
    ],
    faqs: [
      {
        question: "Is automated trading allowed on Kraken?",
        answer: "Yes. Kraken provides a public REST and WebSocket API specifically so clients can trade programmatically, and using a third-party platform with your own API key is permitted. You remain responsible for the orders placed, and you must stay within Kraken's rate limits, which AutoTrader's market-order approach does not come close to straining for typical strategies.",
      },
      {
        question: "Which Kraken API permissions does AutoTrader need?",
        answer: "AutoTrader needs the query permissions to read balances, open orders and trade history, plus permission to create, modify and cancel orders. It never needs Withdraw Funds, deposit or earn permissions, so leave those unchecked. Adding an IP restriction and an expiry date to the key is optional but reduces the damage if the key is ever exposed.",
      },
      {
        question: "Does Kraken have a testnet for spot trading?",
        answer: "Kraken offers a demo environment for its futures platform, but not a public spot sandbox. Because AutoTrader trades Kraken spot pairs, the practical way to rehearse is to run your strategy in AutoTrader's paper mode, review the simulated fills, and then switch it to live with a small investment amount before scaling up.",
      },
      {
        question: "Why does Kraken show XBT instead of BTC?",
        answer: "Kraken historically used the ISO-style code XBT for bitcoin, and its API still returns pair names such as XXBTZUSD or XBTUSD. The website increasingly displays BTC, but API responses and trade exports may use the older codes. It is the same asset, so a BTC/USD strategy in AutoTrader maps to Kraken's XBT/USD market.",
      },
    ],
  },
  bybit: {
    apiSetup: [
      "Log in to Bybit, open the account menu and select API, then choose Create New Key and pick System-generated API Keys.",
      "Select API Transaction as the usage type, give the key a name, and set the permission level to Read-Write so orders can be placed.",
      "Under the Unified Trading or Spot permissions, enable spot trading only. Leave withdrawal, asset transfer and any derivatives permissions unchecked.",
      "Decide on IP restriction: binding the key to specific IP addresses keeps it valid indefinitely, while keys with no IP restriction expire after roughly three months and must be recreated.",
      "Complete the security check (2FA or email code) and copy the API key and secret; the secret is only shown once.",
      "Paste the key and secret on AutoTrader's Exchanges page. For paper testing, create a separate key on the Bybit testnet site, since mainnet keys do not work there.",
    ],
    feesAndAccounts: "Bybit charges spot fees on a maker-taker basis with VIP tiers based on 30-day volume or asset balance. At the time of writing the base spot rate for regular users is around 0.1% for both maker and taker, with occasional promotions on selected pairs. AutoTrader's market orders pay the taker rate. Check Bybit's fee page for current rates.\n\nMost users now have a Unified Trading Account, which holds spot and derivatives balances together. AutoTrader places orders in the spot category only, so keep the quote currency, usually USDT or USDC, in the unified account. Bybit requires identity verification for most features, and there is no meaningful minimum deposit beyond each pair's minimum order value.",
    availability: "Bybit is headquartered in Dubai and serves a large international user base, but it does not accept users from the United States and several other restricted jurisdictions. Its access for UK residents has changed over time, so check the current restricted-countries list before signing up. In the European Economic Area, Bybit operates through a separate entity licensed under MiCA in Austria, which may offer a narrower product range than the global site. Identity verification is required.",
    strengths: [
      "Bybit's V5 API is unified across spot and derivatives with clear documentation, consistent symbol naming such as BTCUSDT, and fast order acknowledgement.",
      "A separate testnet with its own test balances lets you run the exact AutoTrader strategy end to end before connecting a mainnet key.",
      "Deep liquidity on major USDT spot pairs keeps slippage low for market orders, which matters because AutoTrader enters and exits at market.",
      "Fine-grained key permissions let you grant spot trading while keeping withdrawals, transfers and derivatives completely off.",
    ],
    limitations: [
      "Keys without an IP whitelist expire after a few months, so a strategy can stop placing orders if you forget to renew the key.",
      "Testnet order books are thin and prices can diverge from mainnet, so testnet fills are a guide to logic, not to realistic slippage.",
      "Much of Bybit's volume is in perpetuals, and some smaller spot pairs have far less depth than their derivatives counterparts, so check spot liquidity before automating an altcoin.",
    ],
    strategies: [
      { slug: "momentum-trading", reason: "Bybit's active USDT spot markets see sharp momentum bursts around derivatives-driven moves, which momentum rules can ride on the spot side." },
      { slug: "bollinger-bands", reason: "Band-based entries and exits suit liquid pairs like BTCUSDT and ETHUSDT, where volatility expansions and contractions are frequent." },
      { slug: "moving-average-crossover", reason: "A simple crossover is easy to validate on the Bybit testnet first, making it a good first strategy to move from test funds to live." },
    ],
    faqs: [
      {
        question: "Does AutoTrader trade Bybit futures or perpetuals?",
        answer: "No. On Bybit, AutoTrader places spot market orders only, in the spot category of your Unified Trading Account. It does not open perpetual, futures or options positions and does not use leverage. That means your key only needs spot trading permission, and the worst case for a strategy is holding the coin it bought, not a liquidation.",
      },
      {
        question: "Does Bybit have a testnet?",
        answer: "Yes. Bybit runs a separate testnet with its own login, test balances and API keys. Create an account on the testnet site, request test funds, generate a key there and add it to AutoTrader as a paper connection. Mainnet and testnet keys are not interchangeable, so keep them labeled clearly.",
      },
      {
        question: "Why did my Bybit API key stop working?",
        answer: "The most common reason is expiry: Bybit keys created without an IP restriction are only valid for around three months. Other causes are changed permissions, a password or 2FA reset that revokes keys, or an account restriction. Create a new key with spot trading permission, or bind it to IP addresses to avoid expiry, and update it in AutoTrader.",
      },
      {
        question: "Can US or UK residents use Bybit with AutoTrader?",
        answer: "US residents cannot open Bybit accounts, and using a VPN to get around this breaches Bybit's terms and can lead to frozen funds. UK access has changed over time and depends on Bybit's current arrangements, so check its restricted-countries list. US traders may prefer Kraken or Coinbase Advanced, which AutoTrader also supports.",
      },
    ],
  },
  okx: {
    apiSetup: [
      "Log in to OKX, open your profile menu and select API, then choose to create a V5 API key.",
      "Select API trading as the purpose, give the key a name, and create a passphrase. Write the passphrase down, because OKX cannot recover it and AutoTrader needs it.",
      "Tick the Read and Trade permissions only. Leave Withdraw unticked.",
      "Add AutoTrader's IP addresses if you want an IP-bound key; OKX may automatically delete trading keys that are not bound to an IP after a period of inactivity.",
      "Confirm with your 2FA code, then copy the API key and secret key.",
      "Paste the key, secret and passphrase on AutoTrader's Exchanges page. For paper trading, switch OKX to Demo Trading and create a separate demo API key there.",
    ],
    feesAndAccounts: "OKX uses tiered maker-taker fees, with regular users tiered by OKB holdings and VIP levels based on 30-day volume or assets. At the time of writing, entry-level spot fees are around 0.08% maker and 0.10% taker, and AutoTrader's market orders pay the taker side. Check OKX's fee page for current rates, which can differ by region.\n\nOKX offers several account modes, from a simple spot mode up to multi-currency and portfolio margin. AutoTrader always sends orders in cash mode, so it spends only the quote balance you hold and never borrows, whichever mode you choose. Funds must be in the trading account, not the funding account, before a strategy can buy.",
    availability: "OKX serves users in many countries through regional entities with their own licenses. It holds a MiCA authorization in the EU and a license from Dubai's virtual assets regulator, among others. US residents cannot use the global OKX platform and are served instead by a separate US offering with a narrower product set. Some countries are fully restricted, and features vary by region, so check which OKX entity applies to you and what it permits.",
    strengths: [
      "The V5 API covers all products with one consistent design, and the instrument naming, such as BTC-USDT, is clear to map to strategy symbols.",
      "Demo Trading runs against a simulated order book that closely mirrors the live exchange, so strategies can be rehearsed with separate demo keys and no real funds.",
      "Cash-mode orders keep automated spot trading free of borrowing, even inside a unified account that also supports margin and derivatives.",
      "A mandatory passphrase plus optional IP binding adds a layer of protection to keys used by a third-party platform.",
    ],
    limitations: [
      "OKX may remove trading keys that are not bound to an IP after a period of inactivity, so a strategy paused for weeks may need a new key.",
      "Funds deposited to OKX land in the funding account by default and must be transferred to the trading account, which trips up many first-time API users.",
      "Available pairs and features vary by regional entity, so a symbol visible on the global site may not be tradable from your account.",
    ],
    strategies: [
      { slug: "supertrend-indicator", reason: "Supertrend gives clear, infrequent flip signals on liquid OKX pairs like BTC-USDT and SOL-USDT, keeping fee drag low." },
      { slug: "mean-reversion", reason: "OKX's deep spot books on large-cap pairs support buying stretched dips at market with limited slippage." },
      { slug: "vwap-indicator", reason: "VWAP-based entries suit OKX's high-volume USDT pairs, where the volume-weighted price is a meaningful intraday reference." },
    ],
    faqs: [
      {
        question: "Why does OKX ask for a passphrase?",
        answer: "OKX requires you to create a passphrase when you generate a V5 API key, and every signed request includes it. AutoTrader stores it with the key and secret. If you lose it, OKX cannot show it again, so you would need to delete the key and create a new one, then update the details on AutoTrader's Exchanges page.",
      },
      {
        question: "Can I test AutoTrader strategies on OKX Demo Trading?",
        answer: "Yes. Switch the OKX interface to Demo Trading, create a separate API key from within demo mode, and add it to AutoTrader as a paper connection. Demo keys only work against the simulated environment and live keys only work against the real exchange, so keep them labeled clearly to avoid mixing them up.",
      },
      {
        question: "Will AutoTrader use margin or leverage on my OKX account?",
        answer: "No. AutoTrader sends OKX spot orders in cash mode, which uses only the quote balance you already hold. Even if your OKX account mode allows margin or borrowing, cash-mode orders do not borrow. AutoTrader also does not trade OKX perpetual swaps, futures or options.",
      },
      {
        question: "Is OKX available in the United States?",
        answer: "The global OKX exchange does not accept US residents. OKX serves US customers through a separate US platform with its own terms and a more limited product range. Whether that platform works with a given third-party tool depends on its API offering, so US traders should check before relying on it, or consider Kraken or Coinbase Advanced.",
      },
    ],
  },
  kucoin: {
    apiSetup: [
      "Log in to KuCoin, open the account menu and go to API Management, then choose Create API.",
      "Select API trading, give the key a name and set an API passphrase. The passphrase is chosen by you and AutoTrader needs it, so store it safely.",
      "Enable General and Spot Trading permissions only. Leave Withdrawal, Transfer, Margin and Futures unchecked.",
      "Optionally add IP restrictions for extra security, then confirm with your trading password and 2FA code.",
      "Copy the API key and secret; the secret is only displayed once.",
      "Move the funds you want to trade from your Funding Account into your Trading Account, then paste the key, secret and passphrase on AutoTrader's Exchanges page.",
    ],
    feesAndAccounts: "KuCoin uses maker-taker fees with VIP levels based on 30-day volume or KCS holdings, and different base rates for different groups of coins. At the time of writing, the base rate for major spot pairs is around 0.1% for both maker and taker, and paying fees in KCS gives a discount. AutoTrader's market orders pay the taker rate. Check KuCoin's fee page for current rates, especially for smaller altcoins, which can be in higher-fee groups.\n\nKuCoin separates balances into Funding and Trading accounts, and API spot orders can only use the Trading account. Sub-accounts with their own API keys are a convenient way to ring-fence capital for each strategy.",
    availability: "KuCoin operates internationally from Seychelles and requires identity verification to trade. In early 2025 it agreed to exit the US market as part of a settlement with US authorities, so US residents should not use it. Several other countries restrict or prohibit access, and KuCoin has been pursuing local licensing in markets such as the EU. Check KuCoin's list of restricted regions and its terms for your country before depositing.",
    strengths: [
      "The very wide altcoin catalogue lets you run the same strategy across many smaller tokens that are not listed on more conservative exchanges.",
      "Sub-accounts with individual API keys make it easy to give each strategy its own balance and limit how much any one strategy can spend.",
      "The mandatory API passphrase and granular permissions let you create a key limited to spot trading, with transfers and withdrawals disabled.",
      "Many altcoins trade in both USDT and BTC quote pairs, giving flexibility in which currency a strategy accumulates.",
    ],
    limitations: [
      "Liquidity on smaller altcoins can be thin, so market orders from AutoTrader may suffer noticeable slippage; check the order book depth before automating a niche pair.",
      "Funds left in the Funding Account are invisible to API trading, a common cause of insufficient-balance errors for new users.",
      "Newly listed tokens can be extremely volatile in their first days, and AutoTrader's stop-loss executes at market, so fills can be worse than the stop level.",
    ],
    strategies: [
      { slug: "breakout-strategy", reason: "KuCoin's altcoin markets often move in sharp range breakouts, which breakout rules can capture on liquid USDT pairs." },
      { slug: "volume-analysis", reason: "Volume confirmation helps filter false moves on thinner KuCoin altcoin pairs, where price can shift on little participation." },
      { slug: "rebalancing-strategy", reason: "A basket of KuCoin altcoins can be periodically rebalanced to target weights, spreading risk across the wide selection." },
    ],
    faqs: [
      {
        question: "Why does AutoTrader say my KuCoin balance is zero?",
        answer: "KuCoin keeps deposits in the Funding Account by default, and API spot orders can only use the Trading Account. Open your KuCoin assets page, transfer the quote currency, usually USDT, from Funding to Trading, and refresh the connection in AutoTrader. If you use a sub-account, make sure the funds are in that sub-account's Trading Account.",
      },
      {
        question: "Which KuCoin API permissions should I enable?",
        answer: "Enable General, which allows reading balances and orders, and Spot Trading, which allows placing and cancelling spot orders. That is all AutoTrader needs. Leave Withdrawal and Transfer off, and do not enable Margin or Futures, because AutoTrader only places spot market orders on KuCoin.",
      },
      {
        question: "Can I use KuCoin from the United States?",
        answer: "No. KuCoin agreed in 2025 to stop serving US customers as part of a settlement with US authorities, and US residents should not open or use accounts. Using a VPN to get around the restriction breaches KuCoin's terms. US-based traders can connect AutoTrader to Kraken or Coinbase Advanced instead.",
      },
      {
        question: "Is it safe to automate low-cap altcoins on KuCoin?",
        answer: "It can work, but the risks are higher than on major pairs. Thin order books mean market orders can move the price, spreads can be wide, and stops can fill well below their trigger. Start with small investment amounts, favor pairs with meaningful daily volume, and test first in paper mode where it is available.",
      },
    ],
  },
  bitfinex: {
    apiSetup: [
      "Log in to Bitfinex, open the account menu and go to the API Keys section, then choose to create a new key. Bitfinex requires two-factor authentication to be active before it will issue keys.",
      "Give the key a descriptive label such as AutoTrader so you can identify and revoke it later without affecting other integrations.",
      "In the permissions list, enable the Orders permissions (read, create and cancel) and read access to Wallets so AutoTrader can check balances. Leave margin trading, margin funding and all withdrawal permissions switched off.",
      "Optionally restrict the key to specific IP addresses. If you do, whitelist the addresses published by AutoTrader, otherwise requests will be rejected.",
      "Confirm the key through the email and 2FA prompts Bitfinex sends, then copy the API key and API secret immediately, because the secret is shown only once.",
      "In AutoTrader, open the Exchanges page, select Bitfinex, paste the key and secret, and save. Make sure the funds you want to trade sit in your Exchange wallet rather than your Margin or Funding wallet.",
    ],
    feesAndAccounts: "Bitfinex uses a maker-taker fee model with volume-based tiers calculated over a rolling 30-day window. Historically the base spot rates have been around 0.1% for makers and 0.2% for takers, with lower rates for higher volume and additional discounts for holders of the exchange's LEO token. Because AutoTrader places market orders, your fills will normally be charged at the taker rate, so check Bitfinex's fee page for current rates at the time of writing.\n\nBitfinex splits balances into separate Exchange, Margin and Funding wallets. Spot orders placed through the API draw on the Exchange wallet, so moving funds there is a required step before a strategy can trade. Identity verification levels determine which deposit methods and features are available on your account.",
    availability: "Bitfinex is operated by iFinex and is incorporated in the British Virgin Islands. It does not serve residents of the United States, following settlements with US regulators, and it restricts a number of other jurisdictions under its terms of service. Account access depends on completing the required verification level for your country. Before opening an account, review Bitfinex's current list of restricted jurisdictions, since it can change and some features may be limited in particular regions even where the platform itself is available.",
    strengths: [
      "Bitfinex's API is mature and well documented, having supported algorithmic traders for over a decade, so order placement and balance queries behave predictably.",
      "Major pairs such as BTC/USD and ETH/USD have deep order books, which helps keep slippage low on the market orders AutoTrader sends.",
      "Fine-grained key permissions let you grant order access without any wallet transfer or withdrawal rights, keeping a compromised key from moving funds off the exchange.",
      "Bitfinex quotes many pairs directly against US dollars as well as stablecoins, useful for strategies that benchmark performance in fiat terms.",
    ],
    limitations: [
      "The separate Exchange, Margin and Funding wallets can confuse newcomers: a strategy will fail to trade if your balance sits in the wrong wallet.",
      "Bitfinex lists fewer small-cap tokens than altcoin-focused exchanges, and liquidity on less popular pairs can be thin, which increases slippage for market orders.",
      "The exchange's paper trading sub-account uses test pairs that differ from live ones, so it is better for learning the interface than for replicating live strategy results.",
    ],
    strategies: [
      { slug: "trend-following", reason: "Deep liquidity on BTC/USD and ETH/USD lets trend-following systems enter and exit sustained moves with minimal slippage." },
      { slug: "vwap-indicator", reason: "Heavy two-way flow on Bitfinex's major pairs makes volume-weighted average price a meaningful reference for timing entries." },
      { slug: "swing-trading", reason: "Multi-day swing trades reduce the number of taker fills, which matters given Bitfinex's maker-taker fee spread." },
    ],
    faqs: [
      {
        question: "Which Bitfinex API permissions does AutoTrader need?",
        answer: "AutoTrader needs permission to read, create and cancel orders, plus read access to wallets so it can check available balances. You should not enable margin trading, margin funding, wallet transfers or withdrawals. Keeping the key limited this way means AutoTrader can place spot trades for your strategy, but nobody holding the key could move funds out of your Bitfinex account.",
      },
      {
        question: "Why is my Bitfinex strategy not placing trades?",
        answer: "The most common cause is that funds are held in the Margin or Funding wallet instead of the Exchange wallet. Spot orders only use the Exchange wallet balance, so transfer the amount you want to trade there first. Also confirm the API key has order permissions enabled and, if you set an IP restriction, that AutoTrader's addresses are on the whitelist.",
      },
      {
        question: "Can US residents use AutoTrader with Bitfinex?",
        answer: "No. Bitfinex does not open accounts for residents of the United States, so US traders cannot connect a Bitfinex account to AutoTrader. Traders in other regions should check Bitfinex's current restricted jurisdiction list and verification requirements, because availability and certain features vary by country and the list is updated from time to time.",
      },
      {
        question: "Do I pay maker or taker fees when AutoTrader trades on Bitfinex?",
        answer: "AutoTrader sends market orders, which execute immediately against resting orders in the book, so they are charged at Bitfinex's taker rate for your volume tier. Taker rates fall as your 30-day trading volume rises, and LEO token holdings can reduce them further. Check Bitfinex's fee schedule for the rates that apply to your account at the time of writing.",
      },
    ],
  },
  gateio: {
    apiSetup: [
      "Log in to Gate.io, open the account menu and go to API Management, then choose to create a new API key.",
      "Select an APIv4 key, since AutoTrader connects through Gate.io's APIv4 interface, and give the key a recognizable remark such as AutoTrader.",
      "Set spot trading permission to read and write so orders can be placed, and leave withdrawal permission disabled. Futures, margin and other account permissions are not needed for AutoTrader's spot strategies.",
      "Optionally bind the key to trusted IP addresses. Gate.io lets you whitelist IPs per key, which limits where the key can be used if it is ever exposed.",
      "Confirm the creation with your fund password and two-factor code, then copy the API key and secret, because the secret cannot be viewed again later.",
      "In AutoTrader, open the Exchanges page, choose Gate.io, paste the key and secret, and save. Keep the spot balance you want to trade in your spot account.",
    ],
    feesAndAccounts: "Gate.io charges spot trading fees on a VIP tier schedule based on 30-day trading volume and asset holdings. Standard-tier spot fees have historically sat around 0.1% to 0.2% per trade, and paying fees with the exchange's GT token earns an additional discount. Because AutoTrader executes with market orders, expect to pay the taker rate for your tier, and check Gate.io's fee page for current rates at the time of writing.\n\nGate.io offers classic and unified account modes. The spot account is where AutoTrader's orders settle, so funds held in futures or earn products must be transferred back to spot before a strategy can use them. Identity verification is required to trade and to access the full range of deposit and withdrawal limits.",
    availability: "Gate.io serves a worldwide customer base but does not accept users from the United States, and it restricts several other jurisdictions under its user agreement. The group operates regional entities that hold registrations or licenses in some countries, which means available products and onboarding requirements can differ depending on where you live. The exchange has also published proof-of-reserves reports. Check Gate.io's current list of restricted regions before opening an account, as it is revised periodically.",
    strengths: [
      "The very large spot catalogue means strategies can be pointed at mid-cap and newly listed tokens that are unavailable on most other exchanges.",
      "APIv4 is a single, consistent REST interface across products, with per-key permission scopes and IP whitelisting for tight control over what AutoTrader can do.",
      "Many altcoins trade against USDT with continuous activity around the clock, giving 24/7 automated strategies frequent signals to act on.",
      "GT-based fee discounts and VIP tiers reward consistent volume, which benefits strategies that trade frequently.",
    ],
    limitations: [
      "Liquidity varies widely across Gate.io's thousands of pairs; smaller tokens can have wide spreads that make market orders expensive.",
      "Newly listed tokens are often extremely volatile and some are later delisted, so automating them carries higher risk than trading major pairs.",
      "Funds split across spot, futures and earn accounts must be managed manually, since AutoTrader only uses the spot balance.",
    ],
    strategies: [
      { slug: "breakout-strategy", reason: "Gate.io's early listings frequently make sharp breakouts from tight ranges, which breakout rules are designed to capture." },
      { slug: "momentum-trading", reason: "The wide altcoin selection lets momentum strategies rotate into whichever tokens are showing the strongest moves." },
      { slug: "volume-analysis", reason: "Volume filters help separate genuine moves from thin, easily pushed prices on smaller Gate.io pairs." },
    ],
    faqs: [
      {
        question: "Should I create an APIv2 or APIv4 key on Gate.io?",
        answer: "Create an APIv4 key. AutoTrader connects to Gate.io through the APIv4 interface, so keys created for the older API version will not work. When setting it up, grant read and write permission for spot trading only, keep withdrawals disabled, and optionally restrict the key to trusted IP addresses for extra protection.",
      },
      {
        question: "Can I automate newly listed tokens on Gate.io?",
        answer: "Yes, as long as the token trades as a spot pair and has enough liquidity for market orders. Be cautious: new listings on Gate.io can move very quickly, spreads may be wide in the first hours of trading, and some tokens are later delisted. Use a small investment amount and strict stop-loss settings in AutoTrader when targeting young markets.",
      },
      {
        question: "Is Gate.io available in the United States?",
        answer: "No. Gate.io does not accept users from the United States, and several other jurisdictions are also restricted under its terms. Traders elsewhere should confirm their country is supported and complete identity verification before connecting the account to AutoTrader, since products and limits can vary by region.",
      },
      {
        question: "How can I lower my Gate.io trading fees when running a bot?",
        answer: "Gate.io reduces fees as you move up its VIP tiers, which depend on trading volume and asset holdings, and it offers an extra discount when fees are paid in GT. Since AutoTrader uses market orders charged at the taker rate, trading higher-liquidity pairs and avoiding very frequent signals also keeps total costs down. Check the fee page for current rates.",
      },
    ],
  },
  mexc: {
    apiSetup: [
      "Log in to MEXC, open the profile menu and select API Management, then start creating a new API key.",
      "Tick the spot permissions for viewing account details and placing orders, and leave withdrawal and any other unnecessary permissions unticked.",
      "Add a note such as AutoTrader so the key is easy to identify when you review or delete keys later.",
      "Decide on IP binding. MEXC lets you link the key to specific IP addresses; keys created without an IP binding expire after a set period, so you will need to renew them and update AutoTrader when that happens.",
      "Complete the security verification, then copy the access key and secret key, because the secret will not be displayed again.",
      "In AutoTrader, open the Exchanges page, choose MEXC, paste both keys, and save. Keep the funds you want to trade in your MEXC spot account.",
    ],
    feesAndAccounts: "MEXC is known for some of the lowest spot fees among large exchanges. It has long advertised zero maker fees on spot and a low taker fee, with further reductions available when fees are paid in its MX token. Because AutoTrader places market orders, trades are generally billed at the taker rate. Promotions and rates change often, so check MEXC's fee page for current rates at the time of writing.\n\nMEXC separates spot and futures accounts, and AutoTrader's orders draw only on the spot balance. Identity verification levels govern withdrawal limits and access to certain features. Not every spot pair is enabled for API trading, so confirm that the markets you plan to automate accept API orders.",
    availability: "MEXC is registered in Seychelles and operates globally without a license from a major financial regulator such as the SEC or FCA. It does not serve users in the United States and lists other restricted jurisdictions in its user agreement, which it updates from time to time. Because oversight is lighter than at exchanges licensed in the EU or US, traders should weigh counterparty risk carefully and avoid keeping more on the exchange than their strategies need. Confirm your country's status before opening an account.",
    strengths: [
      "Very low spot trading costs make MEXC well suited to strategies that trade often, where fees would otherwise erode returns.",
      "MEXC lists new tokens quickly, so automated strategies can access emerging markets earlier than on most larger exchanges.",
      "Key permissions can be limited to spot account reading and order placement, with withdrawals kept off.",
      "The spot API follows a widely used REST layout with familiar symbol names such as BTCUSDT, so pairs are easy to identify.",
    ],
    limitations: [
      "Some spot pairs are not enabled for API trading, so a token visible on the MEXC website may still reject orders from AutoTrader.",
      "Keys without an IP binding expire periodically, which will stop your strategies until you create a new key and update it in AutoTrader.",
      "Many listed tokens are small and thinly traded; market orders on these pairs can suffer substantial slippage despite the low fees.",
    ],
    strategies: [
      { slug: "scalping-strategy", reason: "MEXC's low spot fees reduce the cost of the frequent, small trades that scalping relies on." },
      { slug: "grid-trading", reason: "Grid-style buying and selling across a range generates many fills, which is more viable where fees are minimal." },
      { slug: "rsi-indicator", reason: "Volatile altcoins on MEXC regularly swing into overbought and oversold territory, giving RSI rules clear signals." },
    ],
    faqs: [
      {
        question: "Why does my MEXC API key stop working after a while?",
        answer: "MEXC applies an expiry to API keys that are not bound to an IP address. When the key expires, AutoTrader can no longer place orders. To avoid interruptions, either bind the key to AutoTrader's IP addresses if supported for your setup, or set a reminder to create a replacement key and paste it into the Exchanges page before the old one lapses.",
      },
      {
        question: "Can AutoTrader trade every token listed on MEXC?",
        answer: "Not necessarily. MEXC maintains a list of spot symbols that accept API orders, and some pairs can only be traded through the website or app. Before building a strategy around a specific token, check that the pair is enabled for API trading, otherwise orders from AutoTrader will be rejected even though the market appears on MEXC.",
      },
      {
        question: "Are MEXC fees really that low for automated trading?",
        answer: "MEXC has consistently offered some of the lowest spot fees in the industry, including zero maker fees on spot for standard users at various times. AutoTrader uses market orders, so you pay the taker rate, which is still low compared with many exchanges. Rates and promotions change, so check MEXC's fee page for current numbers before calculating strategy costs.",
      },
      {
        question: "Is MEXC regulated?",
        answer: "MEXC is registered in Seychelles and does not hold a license from a major regulator such as the US SEC or UK FCA. It does not serve US residents and restricts other countries under its terms. That lighter oversight is worth considering when deciding how much capital to keep on the exchange for automated strategies.",
      },
    ],
  },
  deribit: {
    apiSetup: [
      "Log in to Deribit, open your account settings and go to the API tab, then choose to add a new key.",
      "Set the trade scope to read and write so AutoTrader can place and manage orders, set the account scope to read so balances and positions can be checked, and keep the wallet scope at none or read so no withdrawals are possible.",
      "Optionally restrict the key to specific IP addresses and give it a name such as AutoTrader for easy identification.",
      "Copy the client ID and client secret. AutoTrader authenticates with these using Deribit's client credentials flow, so both values are required.",
      "For practice, create a separate account on the Deribit testnet and generate a key there the same way; testnet keys only work against the testnet and never touch real funds.",
      "In AutoTrader, open the Exchanges page, choose Deribit, paste the client ID and secret, and make sure you connect testnet keys for paper runs and live keys for real trading.",
    ],
    feesAndAccounts: "Deribit charges maker and taker fees on perpetuals and futures as a percentage of the contract's notional value, with option fees structured separately. Perpetual taker fees have historically been a small fraction of a percent, and volume-based tiers can reduce them. Because AutoTrader sends market orders, expect the taker rate. Perpetual positions also pay or receive funding, which can outweigh fees over long holding periods. Check Deribit's fee page for current rates at the time of writing.\n\nBTC-PERPETUAL is an inverse contract margined in bitcoin and sized in US dollar increments, while USDC-margined linear perpetuals are also listed. The collateral currency you hold determines which contracts your strategy can trade.",
    availability: "Deribit is headquartered in Dubai and operates under a license from Dubai's Virtual Assets Regulatory Authority, and it became part of Coinbase following the acquisition completed in 2025. It does not serve residents of the United States and restricts other jurisdictions under its terms of service. Derivatives trading is leveraged, and some countries limit retail access to crypto derivatives, so confirm your eligibility and complete verification before connecting a live account.",
    strengths: [
      "The Deribit testnet mirrors the live exchange with free test funds, so strategies can be run end to end in AutoTrader before risking real capital.",
      "BTC and ETH perpetuals are highly liquid and trade continuously, which suits 24/7 server-side strategies placing market orders.",
      "Scoped API keys let you grant trade access while keeping wallet and withdrawal functions completely disabled.",
      "Deribit's focus on professional traders means its API is designed for automated access, with detailed documentation and stable authentication.",
    ],
    limitations: [
      "Perpetuals are leveraged products: adverse moves can lead to liquidation, so AutoTrader's stop-loss and position sizing should be set conservatively.",
      "Funding payments accrue while a perpetual position is open, which can erode returns on slower strategies that hold for days or weeks.",
      "Deribit's range of underlying assets is narrow, centered on bitcoin and ether, so it offers little diversification compared with altcoin exchanges.",
    ],
    strategies: [
      { slug: "volatility-trading", reason: "Bitcoin and ether perpetuals on Deribit see frequent volatility bursts that volatility-based entry rules can react to." },
      { slug: "supertrend-indicator", reason: "Supertrend's ATR-based trailing line adapts to the fast swings of leveraged BTC and ETH perpetuals and gives clear exit levels." },
      { slug: "atr-indicator", reason: "ATR-based sizing and stop placement helps control risk on leveraged perpetual positions where liquidation is possible." },
    ],
    faqs: [
      {
        question: "Does Deribit have a testnet for automated trading?",
        answer: "Yes. Deribit runs a full testnet that copies the live exchange, with its own accounts, API keys and free test funds. You register separately on the testnet, create a key there, and connect it to AutoTrader in testnet mode. It is a practical way to check strategy logic, position sizing and stop-loss behavior on perpetuals before trading real funds.",
      },
      {
        question: "What does AutoTrader trade on Deribit?",
        answer: "On Deribit, AutoTrader trades perpetual contracts such as BTC-PERPETUAL rather than spot or options. Orders are placed as market orders sized by your strategy's investment amount, and AutoTrader applies its own stop-loss and take-profit rules. Options trading on Deribit is not supported by AutoTrader, even though Deribit is best known for its options market.",
      },
      {
        question: "Which Deribit API scopes should I enable?",
        answer: "Give the key read and write access to the trade scope so orders can be placed, and read access to the account scope so AutoTrader can check balances and positions. Leave the wallet scope with no access or read-only, so the key cannot move funds. You can also restrict the key to IP addresses and revoke it at any time from the API tab.",
      },
      {
        question: "Can US residents use Deribit with AutoTrader?",
        answer: "No. Deribit does not accept residents of the United States and restricts several other jurisdictions, including some that limit retail access to crypto derivatives. Even after becoming part of Coinbase, Deribit's own eligibility rules still apply. Check the current restricted list on Deribit before signing up, and use the testnet to evaluate strategies if you are eligible.",
      },
    ],
  },
};

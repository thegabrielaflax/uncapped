// The ten builders: what each promises, the questions it asks, what it reuses
// from earlier builders, the shape of what it produces, and how its prompt is
// put together. One file, read by the panel and by the prompt tests.

import { activeOffer, focusOffers, priceText, STARTING_POINTS, contactRecord, contactCounts } from './model.js'
import { C } from './brand.js'

// ---------- Discover's questions ----------
export const DISCOVER_QUESTIONS = [
  {
    id: 'start', theme: 'start', kind: 'start',
    q: 'Where are you starting from?',
    help: "There's no wrong answer. Most people start with no idea at all, and that's exactly what Discover is for.",
  },
  {
    id: 'now', theme: 'now', withName: true,
    q: "Let's start with where you are right now. What do you do, and for how long?",
    help: 'Your role, the kind of organization, and anything about your life right now that matters for this (a new baby, a long commute, a sabbatical on the horizon).',
    examples: ['Head of operations at a 200-person logistics company, 11 years in ops', 'Primary school teacher for 8 years, two kids under five, evenings are precious', 'HR business partner in pharma, just back from parental leave'],
    rows: 3,
  },
  {
    id: 'led', theme: 'led',
    q: 'Tell me about a piece of work you led. What did the business need, what did you do, and what happened with it?',
    help: "A smaller example is completely fine. Tell me your own part, not just the team's, and what changed because of it.",
    examples: ['Customers were leaving in their first month. I interviewed 30 of them, found the welcome emails confused people, rewrote the sequence, and early cancellations dropped by about a third.', 'Our school had no reading scheme for kids who arrived without English. I built one with picture cards, trained two colleagues, and the head rolled it out across the year group.'],
    rows: 6,
  },
  {
    id: 'askedFor', theme: 'askedFor',
    q: 'What do people come to you for, at work or outside it?',
    help: 'The things colleagues, friends or strangers ask you about, even if you do them for free. Repeated requests are one of the strongest signals there is.',
    examples: ['Colleagues ask me to look over their slides before big meetings', 'Friends ask me to plan their trips', 'New managers ask how to run their first one-to-ones', 'People ask where I buy my vintage furniture'],
    rows: 4,
  },
  {
    id: 'know', theme: 'know',
    q: 'What do you know that other people find useful, or would struggle to work out on their own?',
    help: 'Systems, rules, industries, processes, shortcuts, a niche you know inside out. It can come from work, study or life.',
    examples: ['How NHS pay bands and interview panels actually work', 'How to get a product into a supermarket', 'Every grant open to small arts charities in Scotland'],
    rows: 4,
  },
  {
    id: 'outside', theme: 'outside',
    q: 'What do you know or do that has nothing to do with work?',
    help: 'Include the side gigs, the favors, the things you make, the places you grew up, what you studied, what you have lived through.',
    examples: ["I've run the school fair for three years", 'I make celebration cakes for friends and family', 'I grew up between Lisbon and London and translate for my family', 'I got through IVF and now everyone sends their friends to me'],
    rows: 4,
  },
  {
    id: 'try', theme: 'try',
    q: "Is there something you'd love to try that we haven't talked about yet?",
    help: "It can be an idea you've had for ages or something you're curious about but have no experience in. 'Nothing yet' is a perfectly good answer.",
    examples: ["I've always wanted to write a children's book", "I'm curious about running workshops", 'I would love to do something with interiors', 'Nothing yet'],
    rows: 3,
  },
  {
    id: 'buyers', theme: 'buyers',
    q: 'Who do you know, or could reach, who might one day pay for help with any of this?',
    help: 'Old colleagues, people in your industry, communities and groups you are part of, people who already ask you for help. Roles and how you know them are enough: no names needed.',
    examples: ['Ex-colleagues who now run small agencies', 'About 40 women in my running group, many with elderly parents', 'Founders I met through a startup accelerator'],
    rows: 4,
  },
  {
    id: 'week', theme: 'week', kind: 'limits',
    q: 'Now the practical bit. What does a normal week look like for this?',
    help: 'Your best guess for a normal week, not a good one. Uncapped uses these numbers to keep every idea realistic.',
  },
  {
    id: 'energy', theme: 'energy', kind: 'energy',
    q: 'Where in your week do you feel most alive, and where most drained?',
    help: 'Pick as many as you like in each group. Anything under "never again" is off the table, full stop.',
    chips: ['presenting', 'writing', 'one-to-one conversations', 'teaching', 'analyzing data', 'managing people', 'selling', 'planning events', 'making things', 'strategy', 'admin', 'evenings and weekends', 'travel', 'cold calling', 'big corporate politics'],
  },
]

// ---------- the ten builders ----------
export const BUILDERS = [
  {
    id: 'discover', num: '01', title: 'Discover', tint: C.blue,
    short: 'Finds the skills and knowledge you could get paid for, and turns them into a specific offer.',
    gets: 'Directions to explore, a comparison, and your first offer with a buyer, a price to test and a first step.',
    bellaWas: '"I could do marketing consulting, I think? I just don\'t know what that would actually be."',
    bellaGot: 'The launch-readiness sprint: founders of consumer brands preparing their first retail launch, $4,500 for four weeks to test, message five founders this week.',
    note: 'start here!',
  },
  {
    id: 'offer', num: '02', title: 'The Offer Builder', tint: C.pinkTint,
    short: "Turns your idea into clear packages, with what's included and what to charge for each.",
    gets: 'A front door, a core package and an ongoing option, each with scope, a price band and the reason for it.',
    bellaWas: 'She had one idea and froze at "what do you charge?"',
    bellaGot: 'Launch audit $1,500 (one week), launch sprint $4,500 (four weeks), launch lead $3,000 a month.',
    needs: ['offer'],
    questions: [
      { id: 'howWork', q: 'How would you like to work with clients on this?', help: 'Pick what sounds most like you. You can change it later.', kind: 'select', options: ['Fixed projects with a clear end', 'A monthly retainer', 'One-to-one sessions or a coached package', 'A small group or cohort', 'Not sure, suggest what fits'] },
      { id: 'hoursPer', q: 'How many hours could one client take, realistically, for the main package?', help: 'Include prep and follow-up, not just meetings. A rough guess is fine.', examples: ['About 15 hours over four weeks', '4 hours a week for a month', 'Two 90-minute sessions plus write-ups'], rows: 2, optional: true },
      { id: 'notFor', q: 'Who would you rather not work with?', help: 'Naming who it isn\'t for sharpens who it is for.', examples: ['Huge corporates with six layers of sign-off', 'People who want me to do the work for them', 'Anyone who needs results in a week'], rows: 2, optional: true },
    ],
    steps: ['Checking the offer against your hours and income goal', 'Building a front door, a core package and an ongoing option', 'Working out a price band from your numbers', 'Writing what is in and out of scope'],
  },
  {
    id: 'brand', num: '03', title: 'The Brand Builder', tint: C.blueTint,
    short: "Works out how to describe what you do, so the right buyer knows you're the person they need.",
    gets: 'Positioning line options in your buyer\'s words, a dinner-party answer, short and long bios, and proof points.',
    bellaWas: 'She could name her job title, but not why a founder should hire her.',
    bellaGot: '"I help founder-led consumer brands launch into retail without wasting their first big shot."',
    needs: ['offer'],
    questions: [
      { id: 'buyerWords', q: 'How would your buyer describe their problem, in their own words?', help: 'The words they would use with a friend, not the words you would use.', examples: ['"We\'ve got one shot at this launch and nobody here has done it before"', '"I keep hiring people and they leave after six months"'], rows: 3 },
      { id: 'proof', q: 'What proof do you have? Numbers, results, things people have said.', help: 'Only real things. If you have none yet, say so and I will suggest what to collect.', examples: ['Led 14 product launches, three past $10m in year one', 'A manager I coached got promoted within six months', 'None yet'], rows: 3 },
      { id: 'knownFor', q: 'What would you love to be known for?', examples: ['The person who makes launches calm', 'Straight talk about money for new founders'], rows: 2, optional: true },
    ],
    steps: ['Finding the buyer\'s situation in your words', 'Drafting positioning lines in three different shapes', 'Writing your bios from your real proof', 'Listing proof worth collecting'],
  },
  {
    id: 'linkedin', num: '04', title: 'The LinkedIn Builder', tint: C.butterTint,
    short: 'Rewrites your LinkedIn profile, from headline to banner, so people can see how to hire you.',
    gets: 'Headline options, an About section, banner wording, Featured slots and a before-and-after view.',
    bellaWas: 'Her profile read like a résumé, and nobody could tell she took on clients.',
    bellaGot: 'Headline: "Helping founder-led brands launch into retail · Launch-readiness sprints"',
    needs: ['offer', 'positioning'],
    questions: [
      { id: 'currentHeadline', q: 'What does your LinkedIn headline say now?', help: 'Paste it in. It helps me show the before and after.', examples: ['Senior Brand Manager at a consumer goods company'], rows: 2, optional: true },
      { id: 'currentAbout', q: 'Paste your current About section, if you have one.', rows: 5, optional: true },
      { id: 'visibility', q: 'Can you be public about this work yet?', kind: 'select', options: ['Yes, fully public', 'Yes, but keep my day job front and center', 'Not yet, keep it subtle'] },
    ],
    steps: ['Checking your buyer is on LinkedIn', 'Writing headline options people would search for', 'Drafting your About section in five moves', 'Choosing banner wording and Featured slots'],
  },
  {
    id: 'content', num: '05', title: 'The Content Builder', tint: C.cream,
    short: 'Gives you content ideas and a structure for every post. You do the writing, so every word sounds like you.',
    gets: 'Three themes, a bank of post ideas each with a hook, story, lesson and invite, and a place to write with feedback.',
    bellaWas: 'She opened the app, stared at a blank screen and closed it again.',
    bellaGot: 'Hook: "Your first retail launch is the most expensive marketing you\'ll ever do." Story: the launch she saved two weeks before it hit shelves.',
    needs: ['offer'],
    questions: [
      { id: 'platform', q: 'Where will you post?', kind: 'select', options: ['LinkedIn', 'Substack', 'Instagram', 'TikTok or short video', 'Not sure yet'] },
      { id: 'opinions', q: 'What do you have opinions about in your field? What do people get wrong?', examples: ['Most onboarding is written for the company, not the customer', 'Teachers are told to differentiate but never given the time'], rows: 4 },
      { id: 'cadence', q: 'How often could you post in a bad week?', kind: 'select', options: ['Once a week', 'Twice a week', 'Every other week', 'Daily (be honest!)'] },
    ],
    steps: ['Pulling stories from what you have told me', 'Shaping three themes around your buyer', 'Building post ideas with a hook, story, lesson and invite', 'Picking your first piece'],
  },
  {
    id: 'substack', num: '06', title: 'The Substack Builder',
    short: 'Works out what your Substack is for, what to write first, how to mention your offer and how to reach your first readers.',
    gets: 'Who you\'re writing for and how it leads to calls, what to publish first and when, ten posts in order (each with what to open with, what to cover and a call to action), how often to post, your first Note, Substacks worth studying, and the rest of your strategy.',
    bellaWas: 'Her best opinions lived in group chats with old colleagues.',
    bellaGot: 'The Launch Room: "Why most first retail launches stall in week three", "The launch plan I wish every founder had"...',
    needs: ['offer'],
    questions: [
      { id: 'reach', q: 'Who should your writing be for first?', help: 'One kind of person you can picture, in a specific moment. It can be your buyer, or the people around them who refer.', examples: ['Owners of small independent cafes in their first two years', 'Adult children of parents coming home from hospital'], rows: 2 },
      { id: 'belief', q: 'What do you keep noticing in your field that others miss, or won\'t say out loud?', help: 'The thing that makes you want to jump in when people talk about it. The one that makes you a little nervous is usually the one worth writing. Skip it and I will leave it as a writing prompt.', examples: ['Most onboarding is written for the business, not for the person starting'], rows: 3, optional: true },
      { id: 'coffee', q: 'If a friend asked you about it over coffee, what would you tell them?', help: 'Say it the way you would actually say it. This is where your voice comes from.', rows: 3, optional: true },
      { id: 'sample', q: 'Share a short piece of your writing, if you have one: a post, an email, a few paragraphs.', help: 'Optional. It helps your Substack sound like you.', rows: 6, optional: true },
      { id: 'voice', q: 'How would you describe your voice when you write about this?', help: 'In the chat, Claude reflects a short voice profile back for you to correct. Skip it if you are not sure.', rows: 2, optional: true },
      { id: 'call', q: 'If a reader wanted to talk, what call would you offer them?', help: 'Who it is for, how long it is, and what they would leave with. Skip it and Claude suggests one from your offer.', rows: 2, optional: true },
      { id: 'want', q: 'What do you most want your Substack to do for your offers?', kind: 'select', options: ['Bring me clients for this offer', 'Land fractional or freelance work', 'Test this idea with the right people', 'Earn subscription income, later', 'Not sure: recommend what fits'] },
      { id: 'publishing', q: 'Do you already publish anywhere, or have a list?', kind: 'select', options: ['Not yet', 'Yes, on Substack', 'Yes, somewhere else (LinkedIn, a blog, another newsletter)', "I have a list I haven't used in a while"] },
      { id: 'rhythm', q: 'What rhythm could you keep in a bad week?', help: 'Not your best week: the one you could keep up when life gets busy. That is the rhythm that builds a reputation.', kind: 'select', options: ['Once a month', 'Every two weeks', 'Once a week', 'Not sure yet'] },
      { id: 'channels', q: 'Where are the people who already know you?', help: 'Group chats, communities, LinkedIn, an email list: where you could send each issue by hand. Skip if you are not sure.', examples: ['LinkedIn, and a WhatsApp group of about 60 founders', 'The church newsletter and my exercise class'], rows: 2, optional: true },
    ],
    steps: ['Listening for your voice', 'Deciding what your Substack is for, and for whom', 'Planning ten pieces in order', 'Planning the call, the cadence and your first Note'],
  },
  {
    id: 'website', num: '07', title: 'The Website Builder', tint: C.pinkTint,
    short: 'Writes your website copy with you, then shows you how to vibe code your site with AI and launch it yourself.',
    gets: 'One-page copy, a starter web page saved in your folder, a ready-to-paste build prompt and launch steps.',
    bellaWas: 'She sent people her LinkedIn because she had nowhere else to point them.',
    bellaGot: '"Launch into retail with a plan that works." [Book a launch audit]',
    needs: ['offer', 'positioning'],
    questions: [
      { id: 'action', q: 'What is the one thing a visitor should do?', kind: 'select', options: ['Book a call', 'Send me an email', 'Join my newsletter', 'Buy a product'] },
      { id: 'link', q: 'Where should that button go?', help: 'Your booking link or email address. Leave it blank and I will mark the gap.', examples: ['https://cal.com/yourname/intro', 'hello@yourname.com'], rows: 1, optional: true },
      { id: 'showPrices', q: 'Show prices on the site?', kind: 'select', options: ['Yes, "from" prices', 'No, talk about price on a call'] },
    ],
    steps: ['Checking whether you need a website yet', 'Writing the hero from your positioning', 'Laying out your offer, proof and FAQ', 'Preparing your build prompt and launch steps'],
  },
  {
    id: 'sales', num: '08', title: 'First 10 Customers',
    short: 'Works out who to approach first for your offer, how to find them, what to say and what to learn, with a simple way to keep track.',
    gets: 'A list of 10 people or concrete ways to find them, your first move, messages to adapt, conversation questions and a tracker.',
    bellaWas: "She didn't know who to message first, or what to say.",
    bellaGot: 'First 10 buyers mapped: a snack brand founder (ex-colleague intro), a skincare founder (met at an event)...',
    needs: ['offer'],
    questions: [
      { id: 'people', q: 'Who already comes to mind for this offer?', help: 'Start with anyone who has already asked you for help with this, or paid you. Then people you would be comfortable texting today, and people you know but have not spoken to in a while. One per line: name or initials, who they are and how you know them. Fewer than 10 is fine: I will show you how to find the rest, and I will only use what you tell me about them.', examples: ['Priya, founder of a snack brand, ex-colleague, asked me for help last year', 'Tom R., ops director at a logistics startup, met at a conference', 'My old manager Sam, now at a VC firm'], rows: 7, kind: 'people', optional: true },
      { id: 'access', q: 'Who do you know around your buyer, and where do your buyers gather?', help: 'People who serve them, work with them, refer them, manage them or used to be them can introduce you. Groups, communities or rooms where buyers talk count too. Skip if none come to mind.', examples: ['A WhatsApp group of about 60 small food brand founders', 'Two care agency managers, and the families at my church'], rows: 3, optional: true },
      { id: 'roomFor', q: 'How many 20 to 30 minute conversations could you have in a normal week?', help: 'Be realistic: I will only plan as many messages as you have room to follow up.', kind: 'select', options: ['1', '2', '3 to 4', '5 or more'] },
    ],
    steps: ['Describing who to look for', 'Sorting buyers from connectors', 'Choosing who to approach first', 'Drafting what to say and what to learn'],
  },
  {
    id: 'delivery', num: '09', title: 'The Delivery Builder', tint: C.butterTint,
    short: 'Builds your client onboarding, from the welcome email and intake questionnaire to your kickoff call agenda.',
    gets: 'A welcome email, an intake questionnaire, a kickoff agenda and a first-week timeline.',
    bellaWas: 'She had no plan for what happens after a founder says yes.',
    bellaGot: 'Welcome email, launch intake questionnaire, kickoff call agenda.',
    needs: ['offer'],
    questions: [
      { id: 'tools', q: 'How will you run the work?', help: 'Video calls, a shared document, a messaging channel, in person...', examples: ['Zoom calls and a shared Google Doc', 'In person workshops plus email'], rows: 2 },
      { id: 'clientType', q: 'Who signs up: a person or a company?', kind: 'select', options: ['An individual', 'A company', 'Both'] },
      { id: 'contact', q: 'How reachable do you want to be between sessions?', kind: 'select', options: ['Email, reply within two working days', 'A messaging channel during office hours', 'Only in scheduled sessions'] },
    ],
    steps: ['Laying out the steps from yes to first session', 'Drafting your welcome email', 'Building your intake questionnaire', 'Writing your kickoff agenda'],
  },
  {
    id: 'operations', num: '10', title: 'The Operations Builder', tint: C.cream,
    short: 'Sets up your booking page and the business basics, from contracts and invoicing to finding an accountant.',
    gets: 'Booking page wording, a contract checklist, invoice essentials, accountant questions and a checklist you can tick off.',
    bellaWas: 'She had no booking link, no contract and no idea who would handle her taxes.',
    bellaGot: 'Book a launch audit call (30 min) · client contract · invoicing set up · accountant found · business account.',
    needs: ['offer'],
    questions: [
      { id: 'country', q: 'Where will you work from?', help: 'Rules on tax and contracts differ by country.', examples: ['United Kingdom', 'United States (California)', 'Portugal'], rows: 1 },
      { id: 'employed', q: 'Are you still employed?', kind: 'select', options: ['Yes, full time', 'Yes, part time', 'No, self-employed already'] },
      { id: 'slots', q: 'When could you take intro calls?', examples: ['Tuesday and Thursday lunchtimes', 'Weekday evenings 6 to 8'], rows: 1 },
    ],
    steps: ['Setting up your booking page rules', 'Listing the three basics', 'Writing your contract checklist', 'Preparing questions for an accountant'],
  },
]

export const BY_ID = Object.fromEntries(BUILDERS.map((b) => [b.id, b]))

// ---------- output shapes (what the model returns) ----------
export const SHAPES = {
  early: `{
 "read": "2 or 3 sentences to them (you, your), as a coach who sees possibilities: reflect one specific thing they told you, connect it to opportunities they can picture, and end on what to explore first. Warm and grounded in their experience; never claim demand you have no evidence for. Never describe the interview or how you worked",
 "testFirst": {"direction": "the id of the direction", "idea": "the exact name of the idea to test first: a firstOffer or a growInto name", "why": "one or two sentences to them: why this one first, from their proof, their access to buyers and how quickly it would teach them something", "learn": "what the first test needs to learn, about what buyers really do"},
 "thenTry": [{"direction": "the id of the direction", "idea": "the exact name of another idea you'd also start with (a firstOffer or growInto name, different from testFirst)", "why": "one sentence to them: why it's worth trying early"}],
 "picks": {"easiest": {"direction": "the id", "idea": "the exact name of the idea easiest to test", "why": "one sentence to them: why it's the easiest to test"}, "mostPerClient": {"direction": "the id", "idea": "the exact name of the idea that could bring in most per client", "why": "one sentence to them"}, "mostExcited": {"direction": "the id", "idea": "the exact name of the idea they seem most excited to try", "why": "one sentence to them, quoting what they said that shows it"}},
 "goalPaths": [{"path": "one way some of these ideas could reach their first income goal, in their currency, e.g. 'one 90-minute review a month at $500'", "tradeoff": "one sentence: what it asks of them and what it gives or gives up"}],
 "strengths": {"capability": ["short phrase"], "enjoyment": ["short phrase"], "aspiration": ["short phrase"], "demand": ["who paid or asked, for what, e.g. 'Two founders asked about supermarket onboarding (not paid)'; only if someone did"]},
 "mainTest": "one sentence: the main thing to test first, about what buyers really do, e.g. 'whether pub landlords will pay a host to fill a quiet weeknight'",
 "unknowns": [{"text": "an uncertainty that matters across these directions, said to them; at most three, the most important first", "about": "you | buyers | rules: 'you' only for something only they can tell you that would change which directions you'd recommend; 'rules' for a license, contract, insurance or regulation to check"}],
 "range": "empty, unless every direction sits in one field: then one or two sentences to them saying the strongest possibilities you see share that field and why, and that exploring interests beyond it is an option, not a requirement",
 "throughLine": "one sentence, in pencil",
 "threads": [{"label": "short name", "kind": "done | knows | wants | curious", "evidence": "a few of their own words"}],
 "directions": [{
   "id": "d1",
   "short": "DIRECTION, 2 to 4 words: the recognizable kind of paid work or business, e.g. 'Customer research consulting', 'Beer tasting events', 'Private home-safety visits'. No invented package name, no buyer segment, no trigger",
   "title": "DIRECTION, one plain line: the kind of work and the problem or outcome it is about, not narrowed to one package",
   "opportunity": "DIRECTION, one or two sentences to them: the capability or opportunity behind it, what people pay for in this kind of work, and why it fits what they told you",
   "basis": "demonstrated | adjacent | aspirational",
   "route": "the way to earn of the first offer: do it for them | do it with them | teach them how | package it | publish it",
   "stage": "ready to test | build toward | stretch idea | personal",
   "whyYou": "the link to something they said",
   "growInto": [{"_": "other offers from the same expertise; never repeat the first offer here", "format": "a small, plain format label a buyer would recognize, e.g. 'Downloadable checklist', 'Live workshop', '90-minute review call', 'Strategy sprint'", "name": "a plain-English offer title, two lines or fewer, that says what it is and who it's for, e.g. 'Before-the-sale delivery checklist for small online shops'; no invented brand names", "lens": "do it for them | do it with them | teach them how | package it | publish it", "family": "its offer family from the bank, e.g. 'Diagnostics and audits'", "change": "one punchy sentence on what changes for the buyer, as you'd say it to them, within what the offer can deliver, e.g. 'Spot the moment your checkout promises Tuesday and your carrier says Friday, before a customer complains.'", "doHeading": "What you'd make | What you'd write | What you'd teach | What you'd review | What you'd build | What you'd do", "does": "two or three short sentences to them: the actual work, concrete enough that they can picture opening their laptop and knowing where to start", "gets": "what the buyer opens, attends, receives or walks away with; if the format is hard to picture, a quick example of what's inside or how they'd use it", "buyers": ["2 to 4 recognizable buyer types, strongest fit first; if a host or employer pays and someone else uses it, say which"], "buyer": "the strongest buyer type, in a few words", "trigger": "one sentence naming a buying trigger: when they'd look for it", "credible": "one or two sentences to them: why it fits you, pointing to a specific story, skill or example you shared", "proof": "one short sentence keeping apart what you've done from what's a guess about buyers, price or demand", "price": "a test price with its unit, as an estimate, e.g. '$15 to $29 per download' or '$2,000 a sprint'", "timeOnce": "one-time creation or prep, e.g. 'about 8 to 10 hours to make the first version'; empty if none", "timeEach": "time each time it's delivered, e.g. '90 minutes live per workshop'; empty if none (a download)", "size": "one session | a few sessions | most of your hours | more than you have now", "test": "a small first action with a plausible buyer", "learn": "one sentence: what that test would tell you (someone trying a draft tells you something different from someone paying)", "next": "a plausible next step it could lead to; empty if none", "needs": "what it needs that you don't have yet (more time, a larger audience, stronger proof); empty if nothing", "volume": "the sales-volume math if it matters, e.g. 'at $20 it takes 25 sales a month to reach $500'; empty if not"}],
   "together": "one sentence to them: how this direction's ideas could work together as a business, e.g. a paid workshop as the way in, then a done-for-you service for those who want it set up; empty if they don't connect",
   "firstOffer": "FIRST OFFER, one line: a concrete first service, product or package within this direction, e.g. 'customer interviews and a findings report for a small product team'",
   "format": "the first offer's small format label, e.g. 'Strategy sprint'", "family": "the first offer's offer family from the bank", "change": "one punchy sentence: what changes for the buyer of the first offer", "doHeading": "What you'd make | What you'd write | What you'd teach | What you'd review | What you'd build | What you'd do", "does": "two or three short sentences to them: the actual work of the first offer, concrete enough to picture", "buyers": ["2 to 4 recognizable buyer types for the first offer, strongest fit first"], "timeOnce": "one-time creation or prep for the first offer; empty if none", "timeEach": "time each time the first offer is delivered", "deliveryHours": "the total time to deliver the first offer once", "size": "one session | a few sessions | most of your hours | more than you have now", "testIt": "a small first action with a plausible buyer for the first offer", "learn": "one sentence: what that test would tell you", "next": "a plausible next step the first offer could lead to; empty if none", "needs": "what the first offer needs that they don't have yet; empty if nothing", "volume": "the sales-volume math if it matters; empty if not", "proof": "one short sentence keeping apart what they've done from what's a guess",
   "shape": {"format": "a recognizable shape, e.g. fixed-price audit, half-day workshop, template pack, paid newsletter, done-for-you project", "receives": ["what the buyer actually gets"], "scope": "what is included and what is not, in one sentence"},
   "buyer": "FIRST OFFER: possible buyers and their situation, as broad as the evidence allows",
   "problem": "the problem in the buyer's terms",
   "whyNow": "what might make them look for it",
   "handover": "what they hold at the end",
   "summary": "one or two sentences: who the first offer is for, what they experience, and what they walk away with. Don't repeat the title",
   "delivery": "what it takes to deliver, including the main costs and anything they would need first",
   "reach": "how they could realistically reach these buyers, from who they know or could reach",
   "priceLow": 1000, "priceHigh": 2000, "priceUnit": "per seat | per project | per session | per booking | per month | per subscriber a month | per item",
   "priceWhy": "one sentence: what this buyer pays for similar outcomes and why this band. A hypothesis unless you were given sources. Never from their income goal",
   "money": {"model": "seats | talk | project | session | retainer | subscription | product", "priceLow": 1000, "priceHigh": 2000, "buyersPerRun": "paying attendees per event (seats only, else null)", "runsPerMonth": "how many events, bookings, projects, sessions, clients, subscribers or items a month, realistically", "costPerRun": "costs for each event, booking, project, session, client, subscriber or item (venue, ingredients, materials, platform fees), 0 if none", "costNote": "what those costs are, in a few words", "fixedCostsPerMonth": 0, "hoursPerRun": {"prep": 2, "delivery": 3}, "hoursPerMonth": {"sales": 4, "admin": 2, "making": "subscriptions only: hours a month writing or making it"}, "basis": "hypothesis"},
   "viability": "one or two sentences, separate from the price: how many sales a month it would take to matter against their goal and hours, and whether finding that many buyers is practical for them. Say plainly when the volume or the effort of finding buyers makes it impractical",
   "demand": {"evidence": "who paid or asked them for what, from what they told you, or 'none yet'", "closeness": "same | adjacent | none: 'same' only if someone asked or paid for this very offer; payment for related work is 'adjacent', not demand for this package"},
   "take": {"appeal": "one sentence: why this is worth exploring for them specifically", "limitation": "one sentence: its main commercial limitation", "basis": "what that judgment rests on, said to them: your experience, an assumption, or research"},
   "whyThisScope": "one or two sentences: why the first offer and its buyers are scoped this way, from their evidence, and which restrictions are choices to test rather than requirements",
   "startWith": "FIRST EXPERIMENT: the narrower buyer group, problem or buying situation the first test starts with, and why it is a good place to start (closest to their proof, easiest to reach, quickest to learn from). A starting point to test, not the whole market",
   "nextTest": {"label": "Plan a validation test", "learn": "one sentence: what the first experiment needs to learn, about real behavior"},
   "firstStep": "something they could do this week to learn about real behavior: who to talk to, and what to ask about what they did, bought or arranged, what was hard and what it cost. Never 'would you pay'. If it depends on a rule, contract or license, make it conditional on what they find",
   "toTest": "the question that decides whether it's worth it",
   "researchQuestions": ["2 to 4 specific things to look up: comparable offers, published prices, buyer language, existing alternatives, and rules, licenses or contract terms to check"],
   "assumptions": [{"belief": "an assumption this direction rests on", "source": "a buyer said it | their own thought | Claude's suggestion", "risk": "high | medium | low"}],
   "fitTime": "how it fits their week", "fitEnergy": "how it fits what energizes them", "speedBasis": "one sentence: why monthsToFirstIncome is what it is",
   "monthsToFirstIncome": 1
 }],
 "leftAside": ["thread: why not now"],
 "questions": [{"q": "a follow-up question", "why": "what it would change"}],
 "clarifications": [{"q": "a short question about an answer that seems missing, contradictory or off-question", "why": "what it would change"}]
}`,
  offer: `{
 "transformation": "from X to Y in N weeks",
 "packages": [{"name": "", "role": "front door | core | ongoing", "for": "who and when", "includes": [""], "notIncluded": [""], "timeline": "", "hours": 10, "priceLow": 0, "priceHigh": 0, "priceUnit": "per project | per month | per session", "priceWhy": ""}],
 "notFor": "", "expansion": "", "anxietyReducer": "", "capacity": "the capacity check in one or two sentences", "testFirst": ""
}`,
  brand: `{
 "positioning": [{"line": "", "angle": ""}], "dinnerParty": "", "credibility": "", "bioShort": "", "bioLong": "",
 "proof": [""], "proofGaps": [""], "wordsToUse": [""], "wordsToAvoid": [""]
}`,
  linkedin: `{
 "buyerOnLinkedIn": "one sentence", "headlines": ["", "", ""], "about": "", "banner": {"line": "", "subline": ""},
 "featured": [{"title": "", "why": ""}], "experience": {"title": "", "description": ""}, "services": [""], "skills": [""], "beforeYouEdit": [""]
}`,
  content: `{
 "themes": [{"name": "", "why": ""}],
 "ideas": [{"theme": "", "type": "intro story | method | audience builder | opinion", "title": "", "hook": "", "story": "a question that prompts the story they should tell", "lesson": "", "invite": "", "source": "what they said that this comes from, or 'suggestion'"}],
 "cadence": "", "firstPiece": ""
}`,
  substack: `{
 "forOffer": {"offer": "the saved offer, named as they would say it", "buyer": "who buys it", "moment": "what is happening in the buyer's business when they would start looking for help, in their terms"},
 "overview": {"writingFor": "who you're writing for, in one or two short sentences, from the saved offer's buyer and what they told you, e.g. 'Self-employed personal trainers who want to write their own client emails and would like a starting point.'", "problems": [{"text": "one problem the reader has, in one short sentence about the reader, using their words where you have them, e.g. 'They lose new clients in the first month and can't tell why.'", "source": "told | suspects | guess: 'told' for what they've seen or several buyers have told them; 'suspects' for a pattern they think happens but haven't checked (a timing or number counts here unless several buyers gave it or they said they'd checked it); 'guess' for a problem you are suggesting they explore, not something they told you", "from": "who said it or where it came from, in a few plain words, or empty, e.g. 'James said week 3 or 4 about his own clients' or 'from your writing sample'"}], "offerFits": "two or three short sentences: what the saved offer gives the reader, how they'd use it, and what's still being tested (for example whether anyone would pay)", "writeAbout": "two short sentences: what the posts show the reader, and what each post helps them do", "toCalls": "two or three short sentences: the reason to book, who the call is for, how long it is, what to bring and what they leave with", "whySubscribe": "two short sentences: why this reader would subscribe now, even if they are months away from buying, in their terms"},
 "world": {"gist": "the reader's world in one plain sentence of 90 characters or fewer", "week": "two or three concrete sentences: what happens in this reader's week that the publication lives in (the moments, the tools, the people, the deadlines), from what the writer told you", "complaints": ["something this reader complains about to a friend, in the words they would use"], "putOff": ["something this reader keeps putting off until Friday"], "notice": ["something the writer notices about those moments that other people miss, from what the writer told you"]},
 "series": [{"name": "a recurring series or format the reader would recognise and come back for, named plainly (never a content pillar like 'innovation')", "what": "what each instalment does, concretely: who is in it, what happens, what the reader takes away", "example": "one instalment, specific to this writer and reader", "fromYou": "what in the writer's own experience or opinions feeds it"}],
 "first": {"piece": 1, "when": "when to publish it, from the time they have, e.g. 'next Tuesday morning'", "ask": "its call to action, in a line: how the reader books a call or gets the resource"},
 "pieces": [{"headline": "a working title in the reader's language, short enough for an inbox", "type": "intro story | methodology | audience builder", "variant": "for a methodology post only: case study (told through someone they have helped, only if they told you about it) | hypothetical (labeled 'if I were helping…') | dream client (a hypothetical company in the reader's exact world); otherwise empty", "idea": "the idea in one sentence: the specific problem, tension or question that earns this reader's click", "whyOpen": "one sentence: why this reader would click it", "job": "what this post does in the plan, said for its type", "whyHere": "one sentence: why it goes at this point in the order and what it sets up next", "series": "the series it belongs to, by name, or empty", "opensWith": "where it opens, in one short sentence", "leadsTo": "how this post connects to the offer, specific to this post", "next": {"kind": "subscribe | reply | share | read next | resource | book a call", "wording": "the closing invitation for this post: a reply asks one specific question; read next names the issue; a resource exists or is worded 'I'm putting together…'; a call says who it is for and what they leave with", "why": "one sentence: why that next step fits this post"}}],
 "call": {"forWho": "who the call is for", "expect": "what someone can expect from it, and how long it is", "pieces": ["the numbers of the pieces whose next step is booking a call"]},
 "cadence": {"start": "how often to start, as one plain instruction, e.g. 'Start with one post a week.'", "day": "a day and time to try, said as a suggestion, e.g. 'Tuesday morning is a suggestion. Pick a morning you can keep.'; empty if there is no reason to suggest one", "rhythm": "how often to publish and why, from the time they have", "firstOut": "which piece goes out first and on what day", "notes": "when to share a Note around each piece"},
 "notes": [{"forPiece": 1, "when": "when to post it, e.g. 'the day before piece 1'", "text": "the Note itself, ready to post. A Note is a short post on Substack, like a tweet: one to three short sentences, under 280 characters, such as a line from the piece, a sharp observation, or a question for the reader. In their voice, built only from what they have told you (their answers, their writing sample, the piece's point); never an invented story, client, quote or number, and never instructions to them", "action": "point to the post | ask a question for the comments | link to book a call", "why": "why that action"}],
 "voice": {"gist": "the answer in one plain sentence of 90 characters or fewer, written to them as 'you', with no jargon", "profile": "two or three sentences to them, in the second person: how they sound when they write about this (rhythm, warmth, humor, how direct), only from their answers and sample", "words": ["a word or phrase they naturally use, quoted from their answers or sample only"], "pov": "their point of view in one sentence, in their terms"},
 "nextAction": "one short sentence to them, under 30 words: what to write first and who to send it to",
 "job": {"gist": "the answer in one plain sentence of 90 characters or fewer, written to them as 'you', with no jargon", "recommendation": "what the publication is for, for this offer now, in one sentence under 25 words", "goal": "a goal they can act on or observe, with a number, a person and a date, counting only what they do or can see (issues sent, the people they send each one to, calls booked, conversations); never estimated rates such as how many readers book or become clients", "why": "why, from where the offer and its evidence are now"},
 "reader": {"gist": "the answer in one plain sentence of 90 characters or fewer, written to them as 'you', with no jargon", "promise": "the reader promise in one sentence, under 25 words: what the reader gets every time, in their terms", "who": "the one person the publication is for", "workingThrough": "the problem keeping them up at night, in their words", "getsEachTime": "what a subscriber can expect every time, in their terms", "relationToBuyer": "how this reader relates to the offer's buyer: the same person, or how they connect"},
 "knownFor": {"gist": "the answer in one plain sentence of 90 characters or fewer, written to them as 'you', with no jargon", "lane": "the lane: what people would call them when describing them to someone else", "belief": "one sentence the reader must believe every time they see the writer's name", "angles": ["an angle they can return to, drawn from their experience, observations or opinions"], "howIssuesBuild": "how the issues build on each other, so the reader learns what to come back for"},
 "offerMention": {"gist": "the answer in one plain sentence of 90 characters or fewer, written to them as 'you', with no jargon", "issue": "which piece", "where": "where in that issue it fits", "inviteType": "book a call | how I can help | a resource", "invitation": "the example invitation, in context, for them to put in their own words: it gets the reader onto their calendar, never asks them to reply", "why": "why this invitation fits what they are ready for"},
 "distribution": {"gist": "the answer in one plain sentence of 90 characters or fewer, written to them as 'you', with no jargon", "start": "how this person should start, chosen for them: a small test with people they know, publishing in public from the start, or both, and why", "cadence": "a rhythm they could keep in a bad week, from the time they have", "aroundEachIssue": ["what to do before, on and after publishing each issue"], "shareWith": ["who to send it to first, by name where they gave names, or by kind"], "toConversation": "how to turn a comment or a message into a booked call"},
 "signals": {"watch": ["a signal that the right people are reading, strongest first"], "useThem": "how to use those signals to choose the next topic or refine the offer"},
 "names": [{"name": "a possible publication name, which can change later", "why": "why it fits the reader and their voice"}],
 "namesGist": "the names in one sentence of 90 characters or fewer, e.g. 'The Monday Ledger, and 2 more'",
 "branding": {"direction": "two sentences to them: the tone, look and kind of imagery that suit the reader and their voice", "avoid": "what to steer away from"},
 "studied": [{"name": "the publication's name, only from the examples they looked at in the chat", "url": "its link, exactly as given", "takeaway": "what to study in it, for this writer", "why": "similar reader | format done well", "angle": "where this writer could take a different angle"}]
}`,
  brief: `{
 "title": "the working title (it can sharpen the plan's headline)",
 "subtitle": "a longer subtitle that sets terms for the right reader, or empty",
 "hook": "two or three sentences: the specific problem, tension or question that earns this reader's attention",
 "angles": [{"angle": "one way into the idea, in a sentence", "why": "what this angle does for this reader"}],
 "pick": "only if there are two genuinely different angles: which one you would pick and why, in one or two sentences; otherwise empty",
 "open": {"where": "the scene, question, observation or moment to start with, concretely: who, where, what just happened", "detail": "the one detail that makes it interesting, and why", "lines": ["an optional opening line in a conversational voice, for them to change; one or two at most"], "imagined": "empty if the scene comes from what they told you; otherwise say plainly that it is imagined"},
 "arc": [{"beat": "a short heading", "onPage": ["what to put on the page, as short lines in order, one thing per line (a sentence or two at most): a step, a question said out loud in quotes on its own line, an example input, what happens to it, what comes out, the evidence that would move the decision. A sample with several lines (a quote, a form, a message) is one item with line breaks"], "reader": "what the reader learns or starts to question here", "leadsInto": "how this beat leads into the next one (empty for the last)"}],
 "yours": {"use": [{"what": "something specific they already said, a story they could tell, or an opinion worth exploring", "from": "where they said it, in a few plain words"}], "question": "one sharp question whose answer would make the post better, or empty", "meanwhile": "a workable angle to write from until they answer, or empty", "check": "which scenes, lines, numbers or rules in this brief are suggestions or imagined, so they never present them as their own; empty if none"},
 "land": {"takeaway": "what the reader walks away thinking or able to do", "line": "an optional closing line or invitation that follows from the story", "next": "subscribe | reply | share | read next | resource | book a call", "why": "one sentence: why that next step makes sense here"}
}`,
  website: `{
 "needItYet": "one honest sentence", "hero": {"headline": "", "subhead": "", "cta": ""}, "gap": {"heading": "", "body": ""},
 "offers": [{"name": "", "description": "", "price": ""}], "proof": {"heading": "", "points": [""]},
 "about": {"heading": "", "body": ""}, "faq": [{"q": "", "a": ""}], "closing": {"heading": "", "cta": ""},
 "launchSteps": [""]
}`,
  sales: `{
 "summary": "one or two sentences to them: what this plan does and the first thing to do",
 "expect": "two or three short sentences, one idea each: ten people to approach are not ten customers; what about ten conversations usually bring for this offer, and roughly when at their pace. Mention a price only if this offer has one saved, and never call a number theirs unless they gave it",
 "stage": "research | sales: 'research' while the buyer or the problem is still uncertain; 'sales' when the evidence supports a buying conversation or a small paid pilot",
 "firstMove": {"slot": 1, "who": "the first person to contact: a name they gave you, or a prospect to find, said plainly", "why": "why this person first", "send": "the message to send, ready to adapt in their own words", "usefulReply": "what a useful reply would tell them"},
 "buyer": {"lookFor": ["what to look for in a person or company"], "relevantNow": ["a sign they would be relevant now"], "hasProblem": "who feels the problem", "champion": "who would push for it inside a business, if different; empty otherwise", "approves": "who approves the spend, if that is someone else; empty if it is the same person", "description": "a practical description of the buyer: one real person, or a company plus the human inside it"},
 "list": [{"slot": 1, "name": "the name or initials they gave you; empty if they described this person without a name, or for a prospect to find", "label": "for someone they described without a name, a short label in their words ('The builder who paid you twice'); empty otherwise", "kind": "known | prospect to find: 'known' for anyone they told you about, named or only described ('the other two families who paid me', 'the other agency manager I know'); 'prospect to find' only for someone they still need to identify", "role": "buyer | connector: 'connector' for anyone around the buyer (serves, works with, refers, manages, used to be, or is friends with them)", "temperature": "hot | warm | cold", "who": "who they are, only from what they told you", "why": "for a buyer, why they might be relevant now; for a connector, who they could introduce", "reach": "how to reach them: how they know each other, or the route to someone like this", "findBy": "for a prospect to find: a concrete search or introduction route and the criteria for picking one; empty for anyone known, named or not", "batch": 1, "messageType": "reconnect | introduction request | direct message", "message": "the first message, specific to this person or route, for them to adapt, in the register the relationship calls for: a text to a friend reads like a text to a friend; a former colleague, warm and brief; someone new, professional and specific about why them. No 'I'm not selling anything' to people who know them", "followUp": "a lighter follow-up for a week later, with a reason to reply"}],
 "routes": [{"route": "warm contacts | former colleagues | introductions | communities | direct outreach", "when": "when to use it, in two or three words: 'Start here' for the first route, then for example 'This week', 'Every call' or 'After batch 1'", "fit": "why this route fits them and this offer", "how": "what to do, concretely"}],
 "callGuide": {"client": {"purpose": "one line, e.g. 'Ask about the last time it happened. Follow the story from there.'", "opener": "the opener they say out loud, in Gabriela's way: thank them warmly, treat them as the expert on their world, give them permission to be honest in her words said in their voice (“Your honesty won't hurt my feelings, I promise. I'd so much rather find out now than spend months building something nobody needs. So please, tell me straight!”), then one warm-up question about their world; never 'I'm not selling anything' or 'this isn't a pitch'", "questions": [{"label": "a short heading, e.g. 'What happened last time?'", "q": "one spoken question about what this person did, tried or paid for; never 'would you'"}], "more": [{"label": "a short heading", "q": "a further question if useful: budget, who approved the spend, what's coming up"}], "close": "a short closing script they can say out loud", "intro": "an ask for two introductions, said out loud on every call: two specific people, described so they can picture who (for example someone who is stuck right now), with an offer to write a short note they can forward; always two, never “one or two”"}, "knows": {"purpose": "", "opener": "", "questions": [{"label": "", "q": "for someone who knows their clients: what they've seen clients struggle with, how clients decide to get help, who makes that decision"}], "more": [], "close": "", "intro": ""}},
 "conversation": {"type": "research | sales | pilot", "why": "why this kind of conversation now", "questions": [{"q": "a question about what they have done, tried or paid for", "group": "the part of the call it belongs to, in two to five words (for example 'Their story', 'What they've tried and spent', 'At the very end'), the same label for every question in that part, in the order they come"}], "close": ["one step to close every conversation, in order, starting with its point: thank them; ask permission to follow up, only if they could buy; ask for two specific introductions; note what you should have asked"], "ask": "for a sales conversation or pilot, how to make the ask clearly in the buyer's words; for research, what in a conversation would justify exploring a small paid pilot", "pilot": {"wantsHelp": "what would show this buyer wants help with it, not just agrees it is a problem", "outcome": "the tightly scoped outcome they could deliver as a small paid pilot for this offer, with no blanks or bracketed placeholders", "decide": "a choice only they can make before offering it, such as how many days after the visit they deliver, said as a decision; empty if none", "approval": "how this buyer would plausibly approve the spend", "ifUnclear": "the next research conversation to have when any of these is unclear"}},
 "tracker": {"record": ["what to write down after each contact, starting with a one- or two-word lead and a colon, e.g. 'Who: their name, how you know them, and whether they could buy or introduce you'"], "review": {"milestones": [{"when": "when to look back, e.g. 'Week 3, about 5 conversations'", "what": "what to look at then, and what to decide"}], "patterns": [{"name": "it's working | right offer, wrong buyer | wrong offer | right offer, wrong words", "looksLike": "what it would sound like from this buyer, in one sentence", "then": "what to do then, in a few words"}]}},
 "weeklyCap": "how many people to contact a week, from the time they have"
}`,
  delivery: `{
 "steps": [{"when": "", "what": ""}], "welcomeEmail": {"subject": "", "body": ""},
 "intake": [{"section": "", "questions": [""]}], "kickoff": {"minutes": 60, "agenda": [{"minutes": 5, "item": ""}]},
 "scope": {"included": [""], "notIncluded": [""], "contact": ""}
}`,
  operations: `{
 "caveat": "one plain sentence", "booking": {"title": "", "length": "", "description": "", "questions": [""], "rules": [""]},
 "basics": [{"item": "", "why": ""}], "contract": {"mustHaves": [""], "redFlags": [""], "employmentCheck": ""},
 "invoicing": {"essentials": [""], "terms": ""}, "accountant": {"whereToLook": "", "questions": [""]},
 "checklist": [{"item": "", "how": ""}]
}`,
  revise: `{"summary": "one or two sentences on what changed and why", "output": { the full revised result, same shape as before }}`,
}

// ---------- context ----------
function line(label, value) {
  const v = String(value ?? '').trim()
  return v ? `${label}: ${v}` : ''
}

// The interview keeps the same themes for everyone, but a few questions are
// worded for where the person is starting from, and the follow-ups and the
// garden are told what to look for.
const START_WORDING = {
  existing: {
    now: { q: 'Tell me what you already sell and who buys it. Which parts do you enjoy, and which would you happily leave behind?', help: "Roughly what it brings in and how much of your week it takes helps too, and any results or repeat clients. A new direction is judged on its own, but what transfers from this business can help it." },
    try: { q: 'What is the new thing you want to explore, and what draws you to it?', help: "It doesn't have to connect to what you already sell. Say what you know about it so far, even if that's very little." },
  },
  explore: {
    led: { q: 'Tell me about something you led or made happen, at work or anywhere else. What was needed, what did you do, and what changed?', help: 'A club, a community project, a family event, a side project, a role at work. Your own part, and what was different afterwards.' },
    outside: { q: 'What do you know or do outside your job that people notice, rely on or ask you about?', help: 'This can be where your strongest ideas are. The things you make, organize, fix or have lived through, and who benefits.' },
  },
  none: {
    led: { q: 'Tell me about a piece of work you led. What did the business need, what did you do, and what happened with it?', help: "Your own part, not just the team's: the problem you solved, who it was for, and what changed. These details are where buyers outside your employer start to show up." },
  },
}

export function questionFor(theme, startingPoint) {
  const base = DISCOVER_QUESTIONS.find((x) => x.theme === theme) || DISCOVER_QUESTIONS[1]
  const v = START_WORDING[startingPoint]?.[theme]
  return v ? { ...base, ...v } : base
}

export const START_GUIDE = {
  none: 'They have no business idea yet. Their employed work is likely their strongest capability, so look past the job title: the specific problems they solved, for whom, the industry, customer or process knowledge they hold, and who outside an employer would pay for that. Do not assume they want to do their current job freelance, and give their life outside work a fair look too.',
  several: 'They have a few possibilities in mind. Take each one seriously and compare them on the same footing, then add others only where their answers support them.',
  existing: 'They already sell something. Understand that business beyond its capacity: the skills and knowledge that transfer, the proof it gives them (results, repeat clients, referrals), the buyers and networks it gives them access to, which parts they enjoy and which they want to leave behind. If they want a new direction, explore it independently, on its own terms: its own buyer, problem, price and economics. Use what genuinely transfers from the existing business without ignoring it: a skill, and where it really helps the new direction, the proof it gives them and the buyers it lets them reach (in reach and whyYou), without pulling them back into the work they want to leave. Never present the new direction as a feeder, upsell or audience builder for what they already sell unless they said they want that, and never rebuild the parts they want to leave behind. Payment for the existing work is not demand for the new direction.',
  explore: "They want to explore something they haven't done professionally. Life experience, community roles, hobbies, making things and repeated requests from friends can be their strongest material: weigh them as seriously as any job. Keep what they have actually shown apart from what they hope to do.",
}
const startGuide = (work) => (START_GUIDE[work.discover?.startingPoint] ? `WHERE THEY ARE STARTING FROM\n${START_GUIDE[work.discover.startingPoint]}` : '')

export function profileText(work) {
  const p = work.profile || {}
  const a = p.answers || {}
  const L = p.limits || {}
  const E = p.energy || {}
  return [
    line('Name', p.name),
    line('Where they are now', a.now),
    line('A piece of work they led', a.led),
    line('What people come to them for', a.askedFor),
    line('Outside work', a.outside),
    line('Something they would love to try', a.try),
    line('What they know that others find useful', a.know),
    line('Who they know or could reach', a.buyers),
    line('Where they are starting from', work.discover?.startingPoint ? `${STARTING_POINTS[work.discover.startingPoint] || work.discover.startingPoint}${a.start ? `: ${a.start}` : ''}` : a.start),
    line('An idea they already have', a.idea),
    line('Hours in a normal week', L.hoursExact ? `about ${L.hoursExact} (${L.hours})` : L.hours),
    line('Goal', L.goal),
    line('Extra monthly income that would feel meaningful', L.income ? `${L.currency || '$'}${L.income}` : ''),
    line('Currency', L.currency || '$'),
    line('More of this', E.more),
    line('Less of this', E.less),
    line('Never again', E.never),
    line('Follow-up answers', Object.entries(work.discover?.followAnswers || {}).map(([q, ans]) => `${q} -> ${ans}`).join(' | ')),
  ].filter(Boolean).join('\n')
}

export function offerText(o, currency) {
  if (!o) return ''
  return [
    line('Direction', o.direction),
    line('Offer', o.name),
    line('Status', o.provisional ? 'provisional: a working offer to test, not yet validated' : ''),
    line('Format', o.format),
    line('Buyer', o.buyer),
    line('Problem', o.problem),
    line('Why now', o.whyNow),
    line('What they hold at the end', o.handover),
    line('Price to test', priceText(o, currency)),
    line('Price reasoning', o.priceWhy),
    line('Evidence from their own experience', o.whyYou),
    line('Still to test', o.toTest),
    line('Where the first experiment starts', o.startWith),
  ].filter(Boolean).join('\n')
}

function packagesText(work) {
  const out = work.builders?.offer?.output
  if (!out?.packages?.length) return ''
  const cur = work.profile?.limits?.currency || '$'
  return 'Packages:\n' + out.packages.map((p) => `- ${p.name} (${p.role}): ${p.for}. Includes ${(p.includes || []).join('; ')}. ${priceText(p, cur)}. ${p.timeline || ''}`).join('\n')
}

function positioningText(work) {
  const pos = work.positioning
  if (!pos) return ''
  return [line('Positioning line', pos.line), line('Short bio', pos.bioShort), line('Longer bio', pos.bioLong)].filter(Boolean).join('\n')
}

export function contextFor(work, id) {
  const cur = work.profile?.limits?.currency || '$'
  const parts = ['ABOUT THEM (their own words unless marked)', profileText(work)]
  const o = activeOffer(work)
  if (o && id !== 'discover') parts.push('', 'THEIR WORKING OFFER (their current best guess to test, not a validated business)', offerText(o, cur))
  // A Substack serves the offers in the working offer's space (offers for the same kind of buyer).
  // Offers in their other spaces have their own Substack, so they stay out of this one.
  const others = o && id === 'substack' ? focusOffers(work).filter((x) => x.id !== o.id && (!o.spaceId || x.spaceId === o.spaceId)) : []
  if (others.length) parts.push('', 'THEIR OTHER OFFERS FOR THE SAME READERS: this Substack supports every offer here and the working offer above, so plan it to serve them all, each mentioned where it fits', ...others.map((x) => offerText(x, cur)))
  const apart = o && id === 'substack' && o.spaceId ? focusOffers(work).filter((x) => x.spaceId && x.spaceId !== o.spaceId) : []
  if (apart.length) parts.push('', `NOT FOR THIS SUBSTACK: they also have offers for different readers (${apart.map((x) => x.name).join('; ')}). Those have their own Substack strategy, so never mention them here.`)
  // Where the offer came from a garden direction, its assumptions and evidence
  // travel with it, labeled for what they are.
  const dir = o && (work.discover?.early?.directions || []).find((d) => d.id === (o.fromDirection || work.discover?.chosenId))
  if (dir && id !== 'discover') {
    const tests = (work.experiments || []).filter((x) => x.source?.directionId === dir.id || x.source?.offerId === o.id)
    const found = tests.flatMap((x) => (x.findings || []).map((f) => f.summary)).slice(-3)
    const sources = (work.research || []).filter((r) => r.directionId === dir.id).reduce((n, r) => n + (r.items || []).length, 0)
    parts.push('', 'WHAT IS AND ISN\'T ESTABLISHED ABOUT THIS OFFER (never present an assumption as a proven claim, a result or a testimonial)',
      line('Untested assumptions', (dir.assumptions || []).map((a) => a.belief || a.text).join('; ')),
      line('Price basis', dir.money?.basis === 'researched' ? 'researched, with saved sources' : 'a hypothesis, not yet tested with buyers'),
      line('Market research', sources ? `${sources} saved sources` : 'none yet'),
      line('Buyer findings so far', found.length ? found.join(' | ') : 'none yet: no buyer has paid or been tested'))
  }
  const pk = packagesText(work)
  if (pk && ['brand', 'linkedin', 'website', 'sales', 'delivery', 'operations', 'content', 'substack'].includes(id)) parts.push('', pk)
  const pos = positioningText(work)
  if (pos && ['linkedin', 'website', 'content', 'substack', 'sales'].includes(id)) parts.push('', 'THEIR POSITIONING', pos)
  const brandOut = work.builders?.brand?.output
  if (brandOut && ['linkedin', 'website'].includes(id)) {
    parts.push('', line('Proof they have', (brandOut.proof || []).join('; ')), line('Buyer words to use', (brandOut.wordsToUse || []).join(', ')))
  }
  // The next two builders share what Discover found, kept apart as it was.
  if (id === 'sales' || id === 'substack') {
    const sig = work.discover?.reading?.signals || {}
    const kind = (k, label) => ((sig[k] || []).length ? `${label}: ${(sig[k] || []).map((x) => (k === 'demand' ? `${demandText(x)} (${x.paid ? 'paid' : 'asked, not paid'})` : x.text)).join('; ')}` : '')
    const ev = [kind('capability', 'Shown they can do'), kind('aspiration', 'Want to grow into'), kind('demand', 'People asking or paying')].filter(Boolean)
    if (ev.length) parts.push('', 'WHAT DISCOVER FOUND (four kinds of evidence, kept apart: never treat interest as payment)', ...ev)
  }
  if (id === 'substack' && work.builders?.sales?.output) {
    const so = work.builders.sales.output
    const tr = work.builders.sales.tracker || {}
    const recs = Object.values(tr).map(contactRecord)
    const learned = recs.map((t) => t.learned).filter(Boolean).slice(-5)
    const intros = recs.map((t) => t.intro).filter(Boolean).slice(-3)
    const cn = contactCounts(recs)
    parts.push('', 'THEIR FIRST 10 CUSTOMERS PLAN (keep every claim consistent with it)', line('Conversations they are having', so.stage === 'sales' ? 'buying conversations or pilots' : 'research conversations'), line('Buyer they are looking for', so.buyer?.description), line('So far', `${cn.sent} message${cn.sent === 1 ? '' : 's'} sent, ${cn.replied} repl${cn.replied === 1 ? 'y' : 'ies'}, ${cn.talked} conversation${cn.talked === 1 ? '' : 's'} had`), line('What they have learned so far', learned.join(' | ')), line('Introductions or encouragement', intros.join(' | ')))
  }
  const ctxNote = work.builders?.[id]?.context?.note
  if (ctxNote) parts.push('', 'CONTEXT CARRIED OVER FROM A TEST THEY ARE RUNNING (use it, keep every claim accurate, never invent results or demand)', ctxNote)
  const learned = (work.experiments || []).flatMap((x) => (x.decisions || []).map((d) => `${x.title}: decided "${d.label}"${d.why ? ` because ${d.why}` : ''}`)).slice(-4)
  if (learned.length && id !== 'discover') parts.push('', 'WHAT THEIR TESTS HAVE SHOWN SO FAR', ...learned)
  const bAns = work.builders?.brand?.answers
  if (bAns && id !== 'brand') parts.push(line('How the buyer describes the problem', bAns.buyerWords), line('Their proof, in their words', bAns.proof))
  return parts.filter((x) => x !== undefined).join('\n')
}

function answersText(def, answers) {
  return (def.questions || [])
    .map((q) => (answers?.[q.id] ? `${q.q}\n${answers[q.id]}` : ''))
    .filter(Boolean)
    .join('\n\n')
}

// One piece of demand, specific: who asked or paid, for what.
// `what` should be a noun phrase ("help with a supermarket onboarding"), but a
// model sometimes writes a sentence ("Asked how onboarding works"), so the
// wording adapts rather than printing "asked for Asked how...".
const VERB_START = /^(asked|asks|paid|pays|wanted|wants|requested|requests|booked|hired|bought|came|brought|keeps?)\b/i
const CLAUSE_START = /^(how|whether|if|what|which|when|where|why|who)\b/i
export function demandText(x) {
  if (!(x?.who && x?.what)) return String(x?.text || x?.what || '')
  const who = String(x.who).trim()
  const what = String(x.what).trim().replace(/[.;]\s*$/, '')
  const first = what.split(/\s/)[0]
  const lower = (t) => (/^[A-Z][a-z]/.test(t) && !/^[A-Z][a-z]+[A-Z]/.test(t.split(/\s/)[0]) ? t[0].toLowerCase() + t.slice(1) : t)
  if (VERB_START.test(first)) return `${who} ${lower(what)}`
  if (CLAUSE_START.test(first)) return `${who} ${x.paid ? 'paid to learn' : 'asked'} ${lower(what)}`
  if (/^for\b/i.test(what)) return `${who} ${x.paid ? 'paid' : 'asked'} ${lower(what)}`
  return `${who} ${x.paid ? 'paid' : 'asked'} for ${/^(Help|Advice|Support|A|An|The|Some)\b/.test(first) ? lower(what) : what}`
}

// Whether the interviewer judged there was enough, for the latest round.
// Two rounds is the interview's limit, not proof there is enough.
// "Enough" is about the person only: enough to recommend directions. Whether
// buyers need them or will pay is what testing finds out, never a shortfall
// of the interview. missing: what only they can tell, that would change the
// recommendations. toTest: what buyers' behavior still has to show.
export function interviewStatus(work) {
  const d = work.discover || {}
  const r = d.reading
  const rounds = d.followRound || 0
  const judged = r?.readiness && r.round === rounds && !(d.followups || []).length ? r.readiness : null
  const missing = judged?.enough === true ? [] : judged?.missing || []
  return { enough: judged?.enough === true, missing, gaps: missing, toTest: judged?.toTest || [], capped: rounds >= 2, unjudged: !judged }
}

// Questions already asked in the interview, with what they said (or that
// they left it), so none is asked again in other words.
function askedText(work) {
  const log = work.discover?.followupLog || []
  if (!log.length) return ''
  return ['QUESTIONS ALREADY ASKED (never ask any of these again, in any wording)', ...log.map((x) => `- ${x.q} -> ${x.answer ? x.answer : "(they didn't answer)"}`)].join('\n')
}

// ---------- prompts ----------
// `methods` is { _voice, discover, offer, ... }: the method files' text.
// What the interview read from their answers: the four kinds of evidence and
// what is still unknown. Kept apart so the garden can't treat an aspiration
// or a compliment as demand.
export function readingText(work) {
  const r = work.discover?.reading
  if (!r?.signals) return ''
  const kind = (k, label) => (r.signals[k] || []).length ? `${label}: ${(r.signals[k] || []).map((x) => `${k === 'demand' ? demandText(x) : x.text}${x.evidence ? ` ("${x.evidence}")` : ''}${k === 'demand' ? (x.paid ? ' [paid]' : ' [asked, not paid]') : ''}`).join('; ')}` : `${label}: none yet`
  return [
    'WHAT THE INTERVIEW FOUND (four different kinds of evidence; never treat one as another)',
    kind('capability', 'Shown they can do'),
    kind('enjoyment', 'Enjoy'),
    kind('aspiration', 'Want to try or grow into'),
    kind('demand', 'Real demand (who asked or paid, for what)'),
    (r.signals.demand || []).length ? 'A request or payment is demand for that thing only: for each direction, say how closely it relates. Payment for adjacent work is not demand for a new package.' : '',
    (r.readiness?.missing || []).length && !r.readiness.enough ? `Only they can tell you, still unknown: ${r.readiness.missing.join('; ')}` : '',
    (r.readiness?.toTest || []).length ? `For testing with buyers (not a gap in the interview): ${r.readiness.toTest.join('; ')}` : '',
    (r.notKnown || []).length ? `They don't know or can't recall (a limitation, not something to ask again): ${r.notKnown.join('; ')}` : '',
  ].filter(Boolean).join('\n')
}

export function earlyReadPrompt(work, methods) {
  return {
    system: methods._voice,
    prompt: [
      methods.discover,
      '',
      methods.opportunities ? `A REFERENCE FROM GABRIELA: WHAT COUNTS AS A COMMERCIAL OPPORTUNITY\n${methods.opportunities}` : '',
      '',
      methods.offerbank ? `GABRIELA'S OFFER BANK: THE GENERATION MENU FOR EVERY GARDEN\n${methods.offerbank}` : '',
      '',
      profileText(work),
      '',
      readingText(work),
      '',
      startGuide(work),
      '',
      (() => {
        const st = interviewStatus(work)
        if (st.enough) return 'INTERVIEW STATUS: the interviewer judged that you know enough about them to recommend directions. Whether buyers need these or will pay is what testing finds out: it goes in mainTest, in unknowns about "buyers" and in each direction\'s test, never as a shortfall of the interview.'
        if (st.missing.length) return `INTERVIEW STATUS: the interview ended with something only they can tell you still unknown: ${st.missing.join('; ')}. Write the directions from what you have. If one of those would change which directions you recommend, put it in unknowns with about "you".`
        return `INTERVIEW STATUS: ${st.capped ? 'the first interview has ended and their latest answers have not been judged' : 'they asked for directions before the interview judged their answers'}. Judge for yourself: only if something only they can tell you would change which directions you recommend, put it in unknowns with about "you". Missing market evidence is never a shortfall of the interview.`
      })(),
      '',
      'Write their portfolio garden in three levels. A DIRECTION is a recognizable kind of paid work or business they could develop: use the reference above to widen what you consider, never as a checklist or a mechanical mapping. A FIRST OFFER is one concrete service, product or package within that direction. A FIRST EXPERIMENT is a small way to learn what matters most, and may start with a narrower buyer group or buying situation. Lead with the direction, give it a plausible first offer, and never collapse the whole direction into one tiny package.',
      'IDEAS ACROSS FIVE WAYS TO EARN. The garden is there to open up their thinking about how they could earn from what they know. Every idea is a first offer or a growInto idea, and each one uses one of five ways to earn: DO IT FOR THEM (deliver the work or build the thing on the buyer\'s behalf), DO IT WITH THEM (work alongside the buyer to solve the problem or make the change), TEACH THEM HOW (help the buyer learn the skill or apply the method themselves: a workshop, training or another teaching format), PACKAGE IT (turn it into something they use themselves: a template pack, a toolkit, a checklist), PUBLISH IT (write it once for many readers: a guide, a paid newsletter, a book). Use the offer bank above as your generation menu: start from the problems they know how to solve, the decisions people trust them to make and what they\'ve learned at work and outside it, then ask who else might pay for that, when they\'d need it and what they\'d buy. Give a curated set, usually 8 to 12 ideas across at least five offer families, using all five ways to earn wherever their experience gives a real basis: include a believable first sale, the bigger piece of work they could already deliver (a project or sprint sized to most of their available hours, priced like the senior work it is), at least two ideas whose buyers sit outside the industry they work in, and at least one idea they wouldn\'t have thought to look for (a new buyer, a different industry, a problem they\'ve never charged for), each grounded in something they told you. One idea per pattern is enough (one tasting idea, not three), and keep what they said they\'re excited about. Each idea must be commercially distinct: choosing it changes what they sell, how they deliver it, or who buys it. When several would be minor variations of one offer (a different length, format or group size of the same thing), keep one and mention the variation in its how. Every idea needs a plausible buyer, a clear reason they\'d pay, and a way of delivering it that fits their week. Lead with the few you\'d test first: testFirst, then up to two more in thenTry, so they can start without making nine decisions at once. The same expertise can and often should appear through several ways to earn (a done-for-you setup, a working session that builds it with the buyer, a workshop that teaches it, a template pack, a guide), and say in together how those offers could work together as a business, for example a paid workshop as the way in and an implementation service for those who want it done for them. Directions are the kinds of expertise those ideas come from: 1 to 6 of them, as many as their experience, interests and access genuinely support. Ground every idea in what they told you; every one is a possibility to test, never proven. Name the idea you would test first in testFirst, with why and what it needs to learn. Give enough range that they can picture different businesses they could build. If something they want to explore has a real thread in their answers (a hobby, a community they love), include it with its own ideas.',
      'For each first offer, settle the buyer, the problem and what might make them look for it, then a recognizable shape that fits that buyer. Specificity should make clear what someone buys, never create a needlessly narrow business: do not stack an industry, a company size, a seniority, a trigger event, an unusual deliverable and an invented package name unless their experience or research justifies each restriction, and say in whyThisScope which restrictions are choices to test. Never vague either: "consulting" or "helping businesses" on its own is not a direction, so keep a clear problem and outcome. Familiar categories such as consulting, training or coaching are fine directions when the problem and outcome are clear; just never make coaching the delivery shape by default, and never write a vague "help someone decide" offer.',
      'INCOME GOAL AND PRICE ARE SEPARATE: their income goal tells you what would make a first experiment worthwhile; it never sets a price. Price every idea from their experience, the buyer\'s problem and the scope of the work, and in goalPaths show two or three different ways some of these ideas could reach their first goal (one engagement a month, a bigger project every few months, or a different model), each with its trade-off. SCOPE TO THEIR CAPACITY: respect their hours, their evenings and their firm noes. Include what they could deliver with most of their available time as well as what they could try in a single session, and say on any idea that needs more capacity, a larger audience or stronger proof than they have. Assess every direction on its own merits: never justify one by feeding another of their businesses. Price the first offer from what the buyer pays for similar outcomes (a hypothesis unless you were given sources), work out the money, and only then check it against their hours and goal. A low price can be credible: judge viability separately, and flag when the volume or the effort of finding buyers makes it impractical for them. Keep apart what they have done, related work, people asking, and people paying: for demand, say who paid or asked, for what, and how closely it relates to this first offer; payment for adjacent work is not demand for a new package. Then 0 to 2 follow-up questions that would most change them.',
      'WHAT THEY SEE FIRST: the read, mainTest and unknowns sit at the top of their screen, then your short list of where to start (testFirst and thenTry, each with why), then picks (the idea easiest to test, the one that could bring in most per client, and the one they seem most excited to try: these can be three different ideas), then goalPaths, then all their ideas grouped by the five ways to earn so they can compare them. Every idea is first seen as a small preview (its format label, its plain title, the one sentence of what changes for the buyer, and its price and time), then opened as a full offer page (what you\'d do, what they\'d get, who might buy it and when, why it fits them, how to test it, then more to consider), so write each part for that place. EXPLAIN EVERY OFFER IN LANGUAGE THEY CAN PICTURE: the title and format alone should tell them what they would sell. In does, describe the actual work: for a guide, what\'s inside and an example of one section; for a workshop, what they\'d teach, what participants would practice and what they\'d leave able to do; for a packaged resource, the files or materials and what\'s in them, and how someone uses them alone; for a service, what they\'d review or do and what they\'d hand over; for a tool, what the buyer puts in, what comes out and what it helps them decide. change is one punchy sentence a buyer would want to hear, specific to this offer and never bigger than what it can deliver. Label buyer, price and demand as guesses to test in proof wherever they\'re untested, and keep what they\'ve done apart from those guesses; the reasoning, pricing and experiment go on each direction\'s page. Write everything they will see to them, in the second person (you, your), strengths and unknowns included; never call them he, she or they, and never guess their gender. Never describe the interview or your own process ("the interview hit its limit", "we ran out of questions", "we didn\'t get far enough"). At most three unknowns, the most important first; any other useful detail belongs under the direction it affects (its assumptions, toTest or researchQuestions). That no research has been done yet is never an unknown: research status is shown separately. Never leave a placeholder such as "[your quote here]", and never add a detail they didn\'t give you (for example whether people were strangers or friends).',
      'RANGE: open up possibilities from real threads in their answers: what they have done, what people ask them for, what they love outside work and what they want to try. Never invent experience, demand or interest they did not express. If the strongest possibilities share one field, say so in range.',
      'RULES AND SPECIALIST QUESTIONS: for licenses, insurance, tax, employment contracts and professional regulation, never state as fact what a rule requires or allows, or that something is covered or permitted. Name it as something to check, say who could answer it (the license holder, their contract or employer policy, the regulator, an adviser), and make any step that depends on it conditional on what they find (for example "If your contract restricts outside work, ..."). Never tell them to notify an employer unless what they told you says they must.',
      'Return exactly this JSON shape, and nothing else. Each direction is one object that closes once, after monthsToFirstIncome; shape, take, demand, nextTest, money and each assumption are the only objects inside it.',
      SHAPES.early,
    ].join('\n'),
  }
}

// For a direction saved before 0.2.1: estimate the money inputs only. The
// arithmetic is done by the panel (lib/money.js), never by Claude.
export function numbersPrompt(work, d, methods) {
  return {
    system: methods._voice,
    prompt: [
      methods.offer,
      '',
      profileText(work),
      '',
      'ONE DIRECTION FROM THEIR PORTFOLIO GARDEN (JSON)',
      JSON.stringify({ title: d.title, buyer: d.buyer, problem: d.problem, handover: d.handover, route: d.route, priceLow: d.priceLow, priceHigh: d.priceHigh, priceUnit: d.priceUnit, hoursPerUnit: d.hoursPerUnit, priceWhy: d.priceWhy }),
      '',
      "Estimate the inputs to this direction's money, realistically for their week. Keep its price band unless it's clearly the wrong unit; if you change it, say why. The price is a hypothesis unless you were given sources: never derive it from their income goal. Don't work out totals: the panel does the arithmetic. Use null for anything you can't reasonably estimate.",
      'Return exactly this JSON shape:',
      '{"model": "seats | talk | project | session | retainer | subscription | product", "priceLow": 0, "priceHigh": 0, "priceUnit": "", "buyersPerRun": "seats only, else null", "runsPerMonth": 0, "costPerRun": 0, "costNote": "", "fixedCostsPerMonth": 0, "hoursPerRun": {"prep": 0, "delivery": 0}, "hoursPerMonth": {"sales": 0, "admin": 0, "making": "subscriptions only"}, "basis": "hypothesis", "why": "one sentence on the price: what this buyer pays for similar outcomes"}',
    ].join('\n'),
  }
}

// The research agent's standing instructions. It runs on the customer's own
// Claude (their plan), started by the panel, with web search, page reading
// and one Uncapped tool to save what it found. Searches are capped by the
// panel, not by trust.
export const researchSystem = (tool = 'mcp__uncapped__save_research') => [
  'You research one portfolio-career direction for an Uncapped customer, from public web sources, so its recommendation can be sharpened. You are not writing a report for them to read.',
  'Look for: comparable offers and who they serve; published prices (with the unit); the words buyers use for the problem; what buyers do instead today; obstacles such as rules, licenses or professional restrictions.',
  'Rules: use at most 6 searches and read at most 4 pages. Link every source. Keep what a page says (fact) apart from what you infer. Never invent a price, a quote or a result. If a page needs a login or fails, list it under couldntRead instead of guessing. Competitors, followers or engagement never prove that anyone buys, or that this person\'s offer would sell: say what still needs talking to buyers or a paid test.',
  `Finish by calling ${tool} once, with direction set to the id you were given, then reply with one line saying it is saved. Do not message the customer, publish anything or change any file.`,
].join('\n')

export function researchPrompt(work, d, today) {
  const L = work.profile?.limits || {}
  return [
    `Today is ${today}. Research this direction (id ${d.id}) and save what you find.`,
    `Direction: ${d.title}`,
    `Buyer: ${d.buyer || ''}`,
    `Their problem: ${d.problem || ''}`,
    d.shape?.format ? `Shape: ${d.shape.format}${d.shape.scope ? `; ${d.shape.scope}` : ''}` : '',
    `Price being considered: ${d.priceLow ?? ''}${d.priceHigh && d.priceHigh !== d.priceLow ? `-${d.priceHigh}` : ''} ${L.currency || ''} ${d.priceUnit || ''} (a hypothesis)`,
    `Where they work: prices in ${L.currency || 'their currency'}; prefer sources from the same country where it matters.`,
    (d.researchQuestions || []).length ? `Questions to answer: ${d.researchQuestions.join(' | ')}` : 'Questions to answer: who else offers this and at what price; how buyers describe the problem; what they do instead; any rules that limit who can offer it.',
    'Save items with kind: comparable | price | buyer-language | alternative | obstacle.',
  ].filter(Boolean).join('\n')
}

// Saved research for one direction, labeled for what it is.
export function researchText(work, id) {
  const list = (work.research || []).filter((r) => r.directionId === id)
  if (!list.length) return 'RESEARCH: none has been done for this direction.'
  return ['RESEARCH SAVED FOR THIS DIRECTION (facts are what sources say; inferences are ours)', ...list.flatMap((r) => [
    `Researched ${String(r.at || '').slice(0, 10)}: ${r.topic || ''}`,
    ...(r.items || []).map((it) => `- [${it.kind || 'source'}] ${it.fact}${it.url ? ` (${it.url})` : ''}`),
    ...(r.inferences || []).map((x) => `- inference: ${x}`),
    ...(r.stillNeeds || []).map((x) => `- still needs buyer research or a paid test: ${x}`),
  ])].join('\n')
}

// Rewrites one direction from the person's corrected answers, in the
// current shape. Used only when they ask, after fixing copied answers.
export function directionPrompt(work, d, methods) {
  return {
    system: methods._voice,
    prompt: [
      methods.discover,
      '',
      profileText(work),
      '',
      readingText(work),
      '',
      'ONE DIRECTION FROM THEIR PORTFOLIO GARDEN (JSON)',
      JSON.stringify(d),
      '',
      researchText(work, d.id),
      '',
      "Rewrite this one direction from their answers as they are now, and from any research above. Keep its three levels: the direction (the kind of work), its first offer and its first experiment. Keep the idea, unless their answers or the research clearly change it. Where research supports a price or a buyer, say so and mark the price basis researched; where it doesn't, keep it a hypothesis. Similar businesses, followers or engagement never prove that anyone will pay this person. Price from the buyer, never from their income goal, and call it a hypothesis. Don't link it to another of their businesses unless they said they want that. Never say an answer was missing or didn't come through. Keep the id.",
      'Return exactly one direction as JSON, in this shape:',
      SHAPES.early.slice(SHAPES.early.indexOf('"directions": [{') + 15, SHAPES.early.indexOf('}],\n "leftAside"') + 1),
    ].join('\n'),
  }
}

export function followUpPrompt(work, methods) {
  const round = (work.discover?.followRound || 0) + 1
  const last = round >= 2
  return {
    system: methods._voice,
    prompt: [
      methods.discover,
      '',
      profileText(work),
      '',
      askedText(work),
      '',
      startGuide(work),
      '',
      'Before growing their portfolio garden, read their answers as a coach would, then decide whether to ask anything more.',
      '1. Judge each written theme (now, led, askedFor, know, outside, try, buyers) as "enough" (a concrete story or detail: what happened, their own part, who benefited, what changed) or "thin" (too vague to build on).',
      '2. Sort what you see into four kinds of evidence. They are different inputs, never interchangeable: capability (what they have shown they can do, with a story behind it), enjoyment (what gives them energy), aspiration (what they want to try or grow into, including things they have never done professionally), and demand (someone actually asked them, or paid them: record who, as a role and never a name, what they asked or paid for as a short noun phrase, and whether they paid; "people would love this" is not demand). Quote a few of their own words as evidence for each item. Leave a kind empty rather than guess.',
      `3. Decide whether you know enough about them to recommend directions: what they have shown they can do, what they enjoy and want, their limits (hours, goal, never-again) and who they could reach. That is the only test. Whether buyers need these directions or will pay for them is what testing finds out afterwards: it is never a reason to say enough is false, and it goes under toTest, not missing. Say enough is false only when something only they can tell you would materially change which directions you would recommend, how they would be priced or whether they fit their week; name it under missing. Filled-in fields and the number of rounds are not the test either way. This is follow-up round ${round} of at most 2${last ? ': the last one' : ''}.`,
      `4. Ask only if enough is false, or if one answer from them could materially change a recommendation (a different buyer, format, price or whether it fits their week): ${last ? 'at most two questions this round' : 'up to three questions'}, the most important first, one purpose each, in Gabriela's approved style ("Walk me through what you actually did..."). Ask only for what they can tell you. If they have said they don't remember, kept no records or don't know something, record it under notKnown and move on; ask an easier version (a rough figure, the last time it happened) only if the answer would still change a recommendation. Never ask again about a topic already asked above just because the evidence is incomplete, never ask for something they have already told you, never ask them to confirm a summary, and never interview for its own sake.${work.discover?.startingPoint === 'existing' ? ' They already sell something: a question about the proof (results, repeat clients, referrals) or the buyer access their business gives the new direction is worth asking only if it would change a recommendation, and never about growing the existing business.' : ''} If enough is true, return no questions.`,
      '5. Write why, missing and toTest to them, in the second person (you, your). Never call them he, she or they.',
      'Return exactly this JSON shape:',
      '{"depth": {"led": "enough | thin", "...": "..."}, "signals": {"capability": [{"text": "", "evidence": "their words"}], "enjoyment": [{"text": "", "evidence": ""}], "aspiration": [{"text": "", "evidence": ""}], "demand": [{"who": "who asked or paid, as a role", "what": "what they asked or paid for, as a short noun phrase, e.g. help with a supermarket onboarding", "paid": false, "evidence": "their words"}]}, "readiness": {"enough": true, "why": "one plain sentence, to them", "missing": ["something only they can tell you that would change which directions you would recommend; empty if none"], "toTest": ["what buyers still have to show by what they do"]}, "notKnown": ["something they said they do not know, cannot remember or have no record of"], "questions": [{"theme": "one of the theme ids", "q": "the question", "why": "what the answer would change, in one plain sentence"}]}',
    ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n'),
  }
}

export function sharpenPrompt(work, methods) {
  const d = work.discover
  const reacted = (d.early?.directions || []).map((x) => `- ${x.id} "${x.title}": ${d.reactions?.[x.id] || 'no reaction'}${d.notes?.[x.id] ? ` (their note: ${d.notes[x.id]})` : ''}`).join('\n')
  return {
    system: methods._voice,
    prompt: [
      methods.discover,
      '',
      methods.opportunities ? `A REFERENCE FROM GABRIELA: WHAT COUNTS AS A COMMERCIAL OPPORTUNITY\n${methods.opportunities}` : '',
      '',
      profileText(work),
      '',
      'YOUR EARLIER DIRECTIONS (JSON)',
      JSON.stringify(d.early?.directions || []),
      '',
      'THEIR REACTIONS',
      reacted,
      '',
      'Sharpen the directions using their reactions and follow-up answers, keeping the three levels (direction, first offer, first experiment). Develop what they loved, make the maybes more specific or explain what would decide them, drop what they rejected, and add at most one new direction only if their answers revealed something. Keep ids for directions you keep. New follow-up questions only where they would still change the picture (0 to 2).',
      'Return exactly this JSON shape:',
      SHAPES.early,
    ].join('\n'),
  }
}

// The research call guide for one First 10 plan: what to say on a live call,
// for a potential client and, if the list has any, for someone who knows them.
export function callGuidePrompt(work, plan, methods) {
  const o = activeOffer(work)
  const cur = work.profile?.limits?.currency || '$'
  const list = (plan?.output?.list || []).map((p) => `- ${p.name || p.label || 'someone'}: ${p.role === 'connector' ? 'can introduce them to clients' : 'a possible client'}${p.who ? ` (${p.who})` : ''}`)
  const cv = plan?.output?.conversation || {}
  return {
    system: methods._voice,
    prompt: [
      methods.sales || '',
      '',
      'ABOUT THEM (their own words unless marked)', profileText(work),
      '',
      'THE OFFER THESE CALLS ARE FOR (a guess to test, not a validated business)', o ? offerText(o, cur) : '',
      '',
      'THE PEOPLE ON THEIR LIST', ...list,
      '',
      (cv.questions || []).length ? `THE QUESTIONS THE PLAN ALREADY SUGGESTS (reuse what is good): ${(cv.questions || []).map((q) => (typeof q === 'object' ? q.q : q)).join(' | ')}` : '',
      '',
      'Write their research call guide: what they can glance at on a live call and find the next question without losing their place. These first calls are research, not sales: find out when the problem last came up, what they did about it, and whether they have already spent time or money trying to fix it. Write it for this offer and for the person they are talking to.',
      '"client" is for talking to a potential client: a purpose line ("Ask about the last time it happened. Follow the story from there."), an opener they say out loud, in Gabriela’s way (thank them warmly, treat them as the expert on their world, give them permission to be honest in her words said in their voice: “Your honesty won’t hurt my feelings, I promise. I’d so much rather find out now than spend months building something nobody needs. So please, tell me straight!”, then one warm-up question about their world; never “I’m not selling anything” or “this isn’t a pitch”), up to four main questions (each a short label and one spoken question about what that person did, tried or paid for, in the past tense, never "would you"), then "more" for questions only if useful (budget, who approved the spend, what is coming up), a short closing script they can say out loud, and an ask for two introductions, said out loud on every call: two specific people, described so they can picture who (for example someone who is stuck right now), with an offer to write a short note they can forward; always two, never “one or two”.',
      '"knows" is for talking to someone who knows their clients (a connector, a former colleague who has seen many of them): what they have seen clients struggle with, how clients decide to get help, and who makes that decision. Null if nobody on their list is someone like that.',
      'Ask about the offer itself only near the end, and only if it would help answer a specific question. Keep any pitch out. Every question is something they would say out loud, in plain words, one question at a time.',
      'Return exactly this JSON and nothing else:',
      '{"client": {"purpose": "", "opener": "", "questions": [{"label": "", "q": ""}], "more": [{"label": "", "q": ""}], "close": "", "intro": ""}, "knows": {"purpose": "", "opener": "", "questions": [{"label": "", "q": ""}], "more": [{"label": "", "q": ""}], "close": "", "intro": ""}}',
    ].join('\n'),
  }
}

export function builderPrompt(id, work, answers, methods, today = '') {
  const def = BY_ID[id]
  return {
    system: methods._voice,
    prompt: [
      methods[id],
      '',
      today ? `Today is ${today}. Every date you write is a real date counted from today, never a placeholder such as [date].` : '',
      '',
      contextFor(work, id),
      '',
      'THEIR ANSWERS FOR THIS BUILDER',
      answersText(def, answers) || '(none)',
      '',
      ...(id === 'substack' && (work.builders?.substack?.examples || []).length ? ['PUBLIC SUBSTACKS THEY LOOKED AT IN THE CHAT (read there; use only these names in "studied")', JSON.stringify(work.builders.substack.examples), ''] : []),
      ...(work.builders?.[id]?.reviseFrom ? [`THEIR EARLIER PLAN, BUILT FOR A DIFFERENT OFFER ("${work.builders[id].reviseFrom.offerName}"): revise it for the offer above. Keep what still applies (people, routes, anything they learned from contacts) and change what depended on the old offer. Say nothing they haven't established.`, JSON.stringify(work.builders[id].reviseFrom.output), ''] : []),
      ...(id === 'sales' ? ['"callGuide" is their research call guide, to glance at on a live call: for "client", a purpose line, an opener they say out loud, in Gabriela’s way (thank them warmly, treat them as the expert on their world, give them permission to be honest in her words said in their voice: “Your honesty won’t hurt my feelings, I promise. I’d so much rather find out now than spend months building something nobody needs. So please, tell me straight!”, then one warm-up question about their world; never “I’m not selling anything” or “this isn’t a pitch”), up to four main questions (a short label and one spoken question each, about what that person did, tried or paid for, never "would you"), "more" for budget, who approved the spend and what is coming up, a short closing script, and an ask for two introductions, said out loud on every call: two specific people, described so they can picture who (for example someone who is stuck right now), with an offer to write a short note they can forward; always two, never “one or two”; "knows" is the same for someone who knows their clients (what they have seen clients struggle with, how clients decide to get help, who decides), or null if nobody on the list is like that. Research, not sales: ask about the offer only near the end if it helps answer a question.', ''] : []),
      ...(id === 'substack' ? ['Every part has a "gist": the answer in one plain sentence of 90 characters or fewer, written to the reader as "you", with no jargon. The panel shows the gists first, so none may be empty.', 'Build the publication before the posts. The "overview" opens the strategy, from the saved working offer (its buyer and what it gives them), Discover and what they told you here: who the reader is, what they are dealing with, where the offer fits and "whySubscribe", why they would subscribe even if they are months away from buying. Each problem says where it came from and, if one person said it, who: a timing or number one person gave is something they suspect, not something they have checked. A problem you are suggesting they explore is marked "guess". "world" is the reader\'s week in specifics, what they complain about to a friend, what they put off until Friday and what this writer notices that others miss. "series" are two or three recurring stories, examples or formats this writer could make their own, concrete enough to picture. Then plan ten posts with the three post types in the method, the intro story first: each says its job, why it goes where it goes and its next step (subscribe, reply, share, read next, a resource, or a call when the post gives a clear reason to want that conversation). Do not write the full briefs here: each post\'s brief is written when they open it. If the plan could be sent to someone in a different business by swapping the name, it is not specific enough. Write all of it in plain words they would say out loud, one idea per sentence.', ''] : []),
      `Return exactly this JSON shape${['sales', 'substack'].includes(id) ? ', and nothing else' : ''}:`,
      SHAPES[id],
    ].join('\n'),
  }
}

// The brief behind one post (10 Nov): what someone needs to draft it in one
// sitting. Written when they open the post, from the strategy around it.
export function briefPrompt(work, plan, i, methods, today = '') {
  const out = plan?.output || {}
  const pieces = out.pieces || []
  const x = pieces[i] || {}
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] != null).map((k) => [k, o[k]]))
  const v3 = isV3Strategy(out) && cardWritten(x)
  const strategy = pick(out, v3 ? ['forOffer', 'publication', 'footer', 'reader', 'knownFor', 'voice', 'job', 'call', 'offerMention'] : ['forOffer', 'overview', 'world', 'series', 'reader', 'knownFor', 'voice', 'job', 'call', 'offerMention'])
  const kind = String(x.type || '').toLowerCase()
  const shape = kind.includes('intro') ? 'This is an intro story. It might open on the moment that made the writer want to start this publication, name every part of what they do as service, say what they believe that others in the field are not saying, and end by pointing somewhere clear (subscribe, reply, or a call).'
    : kind.includes('audience') ? 'This is an audience builder. It might start with a familiar annoyance in the reader\'s week, give that moment a name they would repeat, mirror it in their words, show the other side, and give them something they can try by Friday, ending on a low-pressure door, never a hard sell.'
      : 'This is a methodology post. It might open on a decision the reader is about to get wrong and let them watch the writer\'s judgment work it through: the promise and who it is for, the painful problem, the method in steps with the material written out, proof (only proof they have), and one plain next step.'
  return {
    system: methods._voice,
    prompt: [
      methods.substack,
      ...(v3 ? examplesFor(methods) : []),
      '',
      today ? `Today is ${today}.` : '',
      '',
      contextFor(work, 'substack'),
      '',
      'THEIR ANSWERS FOR THE SUBSTACK BUILDER',
      answersText(BY_ID.substack, work.builders?.substack?.answers) || '(none)',
      '',
      'THE PUBLICATION STRATEGY (already saved)',
      JSON.stringify(strategy),
      '',
      'THE PLAN, IN PUBLISHING ORDER',
      ...pieces.map((p, n) => `${n + 1}. [${p.type || 'post'}${p.move ? `; ${p.move}` : ''}] ${p.headline || ''}${!v3 && p.idea ? ` — ${p.idea}` : !v3 && p.covers ? ` — ${p.covers}` : ''}${!v3 && p.job ? ` (its job: ${p.job})` : ''}${n === i ? '   <- THE POST TO BRIEF' : ''}`),
      '',
      `THE POST TO BRIEF (post ${i + 1} of ${pieces.length}, as planned)`,
      JSON.stringify(v3 ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'research')) : x),
      '',
      ...(v3 ? [NOT_EXHAUSTIVE, '', ...materialBlock(work.builders?.substack), 'This post\'s card (above) is the plan. The brief goes deeper than the card without repeating it, and never changes its angle, reader or offer (method 5c). Give three headline options with your pick and why, then two ways in, how you\'d open it, the arc in detail from the card\'s beats (with the material written out, and where each cultural moment from the card could sit), the stories you know about them, how it lands with the card\'s ending written out in full, and what to check before posting. Copy the level of the post 3 brief in the worked example, never its content. Write in flowing sentences, no em dashes.', ''] : []),
      `Write the brief for post ${i + 1} as their creative director and strategist, sitting down with them over coffee: "Here's the idea. Here's what grabs them. Here's how I'd open it. Here's the story, beat by beat. Here are the stories I know about you that belong in it. Here's how it lands, and what we ask them to do." Talk to them, warm and specific, with an opinion. When they finish reading it they should think "I know exactly what I'm going to write, and I'm excited to write it". You give them the idea, the structure and the material; they write the post in their own words. Never write the post itself.`,
      'How posts that convert are often built (Gabriela\'s examples, 11 Nov; patterns to draw on where they fit this post, not a checklist): open on a specific lived moment, not a thesis; admit a gap or a mistake before claiming a lesson; give the idea a name the reader would repeat and define it in one plain sentence; structure the middle as a few numbered or labelled parts, each with a bold label and a plain gloss; anchor claims in real numbers they gave you (hours, prices, counts, dates); show a client story with its result, anonymised; give the reader something to copy (a script, a template, a "this week" list); close on one short line they will remember. Mix intro stories, methodology and audience builders across the plan, as planned.',
      'Sound like a person, not like AI writing: no "In today\'s fast-paced world", no "Let\'s dive in", no "It\'s worth noting", no "game-changer", no "unlock", no tidy summary that repeats the body, no hedging both sides, no emoji as decoration. Contractions, a little humour and a clear opinion are welcome.',
      'When you don\'t have a concrete story of theirs for a beat, never invent one. Prompt them instead, in the beat itself: "Think about a time when…", "Is there a moment like this you could pull in?", "If you\'ve had a client say this, use their words." Put those prompts where the story would go.',
      shape,
      'Give this piece its own reason to exist and its own rhythm. If another post in the plan owns a topic (a test, a method, a story), point to that post in one line instead of teaching it here, and tee up the next related post where it helps.',
      'Each beat\'s "onPage" is a list of short lines, one thing per line, so it reads at a glance on a phone: never one long paragraph. Write the material out. If a beat asks two questions, write the two questions. If it walks through a workflow, show a plausible input, what happens to it and what comes out. If the post shows a form, a quote, a checklist, a message or a page, show a short sample of it. If the premise is a decision, show the evidence that would move it. Use concrete, plausible numbers in imagined scenes (a $10,000 build quote, three photos and a text that says "How much?"), labeled as imagined; never a blank or a placeholder such as $X or [number]. Four to six beats, from the opening to the ending.',
      'If the piece has a decision or complication where the easy answer is wrong, find it (for an invented bakery: the order form looks simple until a customer needs the cake by Saturday and the oven is already booked). Build a beat around it: what the reader would assume, what actually changes, what the writer would still check, and what that means for the reader.',
      'When the post involves asking other people anything, use Gabriela\'s research method: ask about the past and what they did ("Walk me through the last time…", "Can you show me the last one?"), or for a small real commitment ("Would you send me your next one so we can try it on that?"). Never a hypothetical price ("If I charged you…") or "Would you use this?". Say which signals would move the decision: behavior (they send a real example, ask to use it again, pay) counts; compliments ("Yeah, I\'d use that") are a yellow flag. Pick the people who did the task recently and can bring a recent example.',
      'Where it suits the post, end with something small and specific the reader can do this week (who to ask, what to write down, what to open), then the next step. A reply asks one question the reader can answer from their own week, in a sentence.',
      'Truth: client work, quotes, results, numbers and personal rules come only from what they told you. Their own rules and opinions are theirs only if they said them; otherwise frame them as a suggested test or a question. Label every imagined scene and every suggested line as such, and list them in "yours.check". Use their exact words where you have them.',
      'The opening lines and the closing line are optional suggestions in a conversational voice, one or two at most, for them to change. Never write the post itself.',
      'Sell in almost every post (Gabriela, 11 Nov), with the offer fitting the argument rather than bolted on: not every post is a pitch. The ending asks the reader to take one step toward working with them: book the call, look at the offer, or get their resource or lead magnet if they have one. Say who it\'s for and what they leave with, in a sentence. Fit the tone to the type: an intro story can pair it with subscribe, a methodology post makes the plainest invitation, an audience builder opens a softer door. A one-line PS mention mid-post is fine. Give an example call to action in their voice. Only a post the plan says is purely for trust skips the ask, and then it asks one reply question instead.',
      'Return exactly this JSON shape, and nothing else:',
      v3 ? SHAPES.brief3 : SHAPES.brief,
    ].join('\n'),
  }
}

export function revisePrompt(id, work, review, methods) {
  const b = work.builders[id]
  return {
    system: methods._voice,
    prompt: [
      methods[id],
      '',
      'A shared fact this result was built from has changed. Revise ONLY the parts that depend on the change. Keep everything else word for word, including any wording the person edited themselves. Do not improve unrelated parts.',
      '',
      'WHAT CHANGED',
      review.reason,
      review.before ? `Before: ${JSON.stringify(review.before)}` : '',
      review.after ? `After: ${JSON.stringify(review.after)}` : '',
      '',
      'UP-TO-DATE CONTEXT',
      contextFor(work, id),
      '',
      'THE CURRENT RESULT (JSON)',
      JSON.stringify(b.output),
      '',
      'Return exactly this JSON shape:',
      SHAPES.revise,
    ].join('\n'),
  }
}

export function feedbackPrompt(work, idea, draft, methods) {
  return {
    system: methods._voice + '\nFor this task only, reply in plain text, not JSON: up to 120 words.',
    prompt: [
      methods.content,
      '',
      contextFor(work, 'content'),
      '',
      `The post idea: ${idea?.title || ''}. Hook: ${idea?.hook || ''}`,
      'Their draft:',
      draft,
      '',
      'Give coaching feedback, never a rewrite: what works, then up to three specific suggestions with the reason for each.',
    ].join('\n'),
  }
}

// ---------- parsing ----------
export function parseJson(text) {
  if (!text) throw new Error('empty reply')
  let t = String(text).trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a < 0 || b < a) throw new Error('no JSON object in the reply')
  return JSON.parse(t.slice(a, b + 1))
}

// Light checks that the parts the panel draws are present.
export function checkShape(kind, v) {
  const need = {
    early: ['read', 'directions'],
    offer: ['packages'],
    brand: ['positioning', 'bioShort'],
    linkedin: ['headlines', 'about', 'banner'],
    content: ['themes', 'ideas'],
    substack: ['job', 'reader', 'offerMention', 'distribution'],
    website: ['hero', 'offers'],
    sales: ['firstMove', 'list', 'conversation'],
    delivery: ['welcomeEmail', 'intake', 'kickoff'],
    operations: ['booking', 'checklist'],
    revise: ['output'],
    numbers: ['model', 'priceLow'],
    direction: ['title', 'buyer'],
  }[kind] || []
  if (kind === 'plan') need.push('title', 'guide')
  if (kind === 'organise') need.push('summary')
  if (kind === 'reading') need.push('learned', 'evidence')
  const missing = need.filter((k) => v == null || v[k] == null)
  if (missing.length) throw new Error(`the reply was missing ${missing.join(', ')}`)
  if (kind === 'early' && (!Array.isArray(v.directions) || v.directions.length === 0)) throw new Error('no directions came back')
  // New strategies list their pieces; a strategy saved before 9 Nov lists issues instead.
  if (kind === 'substack') {
    const list = Array.isArray(v.pieces) ? v.pieces : v.issues
    if (!Array.isArray(list)) throw new Error('the reply was missing pieces')
    if (list.length < 3) throw new Error('fewer than three pieces came back')
  }
  return v
}

// ---------- readable copies (the kit) ----------
function mdList(arr) {
  return (arr || []).map((x) => `- ${typeof x === 'string' ? x : Object.values(x).filter((y) => typeof y === 'string').join(': ')}`).join('\n')
}

export function toMarkdown(id, work) {
  const def = BY_ID[id]
  const cur = work.profile?.limits?.currency || '$'
  const head = `# ${def.num} ${def.title}\n\n_${def.short}_\n\n`
  if (id === 'discover') {
    const o = activeOffer(work)
    const d = work.discover
    return head + (o ? `## Your first offer: ${o.name}\n\n${offerText(o, cur)}\n\nFirst step: ${o.firstStep || ''}\n\n` : '') +
      (d.early ? `## Your early read\n\n${d.early.read}\n\nThrough-line: ${d.early.throughLine || ''}\n\n## Directions\n\n` + (d.early.directions || []).map((x) => `### ${x.title}\n${x.stage} · ${x.route}\n\nBuyer: ${x.buyer}\nProblem: ${x.problem}\nWhy now: ${x.whyNow}\nThey hold at the end: ${x.handover}\nWhy you: ${x.whyYou}\nTo test: ${x.toTest}\nPrice to test: ${priceText(x, cur)} (${x.priceWhy})\nFirst step: ${x.firstStep}\nYour reaction: ${d.reactions?.[x.id] || 'none'}\n`).join('\n') : '')
  }
  const b = work.builders?.[id]
  if (!b?.output) return head + '_Not built yet._\n'
  return head + jsonToMd(b.output, 2)
}

function jsonToMd(v, depth) {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v) + '\n'
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) return mdList(v) + '\n'
    return v.map((x, i) => `${'#'.repeat(Math.min(6, depth + 1))} ${x.name || x.title || x.item || x.section || x.q || x.line || i + 1}\n\n${jsonToMd(x, depth + 1)}`).join('\n')
  }
  return Object.entries(v).map(([k, x]) => (typeof x === 'string' || typeof x === 'number' ? `**${k}**: ${x}\n` : `${'#'.repeat(Math.min(6, depth))} ${k}\n\n${jsonToMd(x, depth + 1)}`)).join('\n')
}

// ======================================================================
// Substack v3 (11 Nov 2026, Gabriela's v3 Substack standard): a strategy is
// written in four steps. 1 choose the publication and ten posts; 2 research
// each post on the web (an agent the panel starts); 3 write each post's card,
// one call per card; 4 check each card, rewriting once with what failed.
// ======================================================================

// A strategy in the v3 shape: it has a publication, or posts with cards.
export const isV3Strategy = (out) => Boolean(out && (out.publication || (out.pieces || []).some((p) => p && p.reader && p.problem && p.offerFit)))
// A post whose full card has been written.
export const cardWritten = (p) => Boolean(p && String(p.reader || '').trim() && String(p.problem || '').trim() && String(p.offerFit || '').trim() && Array.isArray(p.arc) && p.arc.length)

const V3_TOP = ` "publication": {"whoFor": "who you're writing for: the reader as one person in a specific moment, in two or three flowing sentences ('Picture…' when imagined)", "belief": "the belief they'll repeat in every issue, in their words where you have them", "namedThing": {"name": "a named ritual, test or concept readers can adopt (method 5a, the named thing), from a habit or pattern they told you about", "what": "two or three sentences: what it is and where it comes from in what they told you", "posts": [3]}, "series": {"name": "a recurring series readers would recognise", "what": "two or three sentences: what each instalment is", "firstPost": 8}, "whySubscribe": "one or two sentences: why they'd subscribe before they're ready to buy"},
 "footer": {"lead": "When you're ready, here's how I can help:", "items": [{"name": "the call or offer's name, as they gave it", "text": "who it's for, what it is, what they bring and what they leave with, using only confirmed details; a booking link they haven't given is written [add your booking link]"}]},
 "orderNote": "one flowing paragraph: why the ten posts go in this order and what each stretch sets up",
 "material": [{"item": "one usable story, phrase, habit, number, opinion or personal detail, said concretely", "source": "where it came from, in their terms: your work story | what people come to you for | what you know | outside work | something you'd love to try | who you know | more of this | your Substack answers | your offer | your First 10 plan"}],
 "pieces": [{"headline": "the headline (method 5a, Headlines): a number, a confession, a name or a mild provocation, in the reader's words or theirs, short enough for an inbox", "subtitle": "a subtitle that adds the stakes", "type": "intro story | methodology | audience builder", "move": "the move from method 5a by its name, or a short name of your own when none fits", "form": "how this post expresses their expertise, in a few words: a story, an analysis, an observation, an opinion, a prediction, a demonstration, a researched example, an interview, a guide, or your own", "builds": ["the ids of the field research findings this post uses, if any"], "status": "ready | needs a detail | do this first", "angle": "two to four flowing sentences in the strategist's voice: what the post is, the story or material at its centre, and why a reader will care; enough for a card writer to develop without guessing; never a label", "uses": ["the material it draws on, as listed in material"], "needsFirst": "for 'needs a detail' or 'do this first': exactly what they need to find, check, ask or do first; empty when ready", "ask": "your next step | soft door | read to the end: the shape of this post's main ask (method 5b)"}],`

const V3_PIECE = V3_TOP.slice(V3_TOP.indexOf('"pieces": ') + 10).replace(/,\s*$/, '')
// Step 1's shape: today's strategy fields (which Growth and "What this is
// built on" still draw), without today's post entries, plus the v3 parts.
SHAPES.substack3 = SHAPES.substack.split('\n').filter((l) => !l.startsWith(' "pieces"')).join('\n')
  .replace(/ of 90 characters or fewer/g, '').replace(/\{"piece": 1,/, '{"piece": 1,').replace(/^\{/, `{\n${V3_TOP}`)

SHAPES.card = `{
 "reader": "three to five flowing sentences: the reader as a specific person in a specific moment, what she runs or does, what just happened and what she's about to do ('Picture…' when imagined); include who buys if that's someone else",
 "problem": "three to five flowing sentences: the problem in her terms, what it's costing her, and what she gets wrong about it",
 "offerFit": "two to four flowing sentences: where in the post the reader sees their judgment, what she can do herself after reading, and what paid help adds that the post can't",
 "idea": "one or two paragraphs in the strategist's voice: what the post argues or shows, why it's theirs to write (pointing to what they told you), and why a reader will enjoy it; name a writer who does something similar well only if one is in this post's research",
 "arc": [{"title": "a short beat title", "text": "a full paragraph: what happens on the page, the actual material (numbers, questions, steps, the scene) and what the reader thinks or feels at that point"}],
 "makeItFun": [{"kind": "tension | example | reader question | finding | point of view | cultural moment", "name": "a short name for it", "use": "one or two sentences: what it is and what it gives this post", "url": "exactly as given in the research for this post", "source": "the site's name exactly as given, e.g. Wikipedia"}],
 "inspiration": [{"author": "the writer", "title": "the piece's title", "borrow": "one or two sentences: what to borrow from it for this post", "url": "exactly as given in the research for this post", "source": "the site's name, e.g. Substack"}],
 "yourMaterial": [{"item": "something from their answers this card uses", "source": "where it came from, in their terms"}],
 "toAdd": [{"what": "what only they can supply here: their own story, a detail, a number, a permission", "prompt": "a question built from this post that might jog their memory: a specific situation from their offer, audience or background, then the question", "ifNothing": "how to write the post if nothing comes to mind"}],
 "beforeYouWrite": "only when needed: what they have to do, check or ask before writing, in one to three sentences; otherwise empty",
 "cta": {"shape": "your next step | soft door | read to the end", "bridge": "the sentence that connects the post to the ask", "wording": "the full ending, ready to copy, using only confirmed details; [add your booking link] where their link goes"}
}`

const examplesFor = (methods) => (methods['substack-examples'] ? ['', 'WORKED EXAMPLE (it shows what good looks like: copy its level, voice and depth; never its topics, people, stories, sources or structure)', methods['substack-examples']] : [])

// The principle behind every Substack prompt (Gabriela, 12 Nov): her guidance shows what good looks like; it is not a closed set.
export const NOT_EXHAUSTIVE = 'The method, its moves, its reading list and the worked examples show what good can look like. They are not exhaustive and not a closed set of options, topics, people or sources: they cannot anticipate this person, their industry, their stories or their situation. Reason about this person, make connections, and use any form, angle, idea or source that serves them, including ones the method never names. Never recycle the examples\' topics, people, stories or sources for someone else.'

// What the person told the chat for this strategy: stories, observations and views, in their words (save_writing_material).
export function materialLines(b) {
  const xs = Array.isArray(b?.material) ? b.material : []
  return xs.filter((x) => x && String(x.answer || '').trim()).map((x, i) => {
    const d = x.developed || {}
    const dev = ['why', 'seen', 'disagree', 'limits'].map((k) => (String(d[k] || '').trim() ? `${k === 'why' ? 'why they believe it' : k === 'seen' ? 'what they have seen' : k === 'disagree' ? 'who would disagree' : 'when it would not apply'}: ${String(d[k]).trim()}` : '')).filter(Boolean)
    return `${i + 1}. [${x.kind || 'story'}${x.endorsed === false ? ', NOT confirmed as their view' : ''}] ${String(x.answer).trim()}${x.asked ? ` (asked: ${String(x.asked).trim()})` : ''}${dev.length ? ` (${dev.join('; ')})` : ''}`
  })
}
const materialBlock = (b) => {
  const lines = materialLines(b)
  return lines.length ? ['THEIR STORIES AND VIEWS, GIVEN IN THE CHAT FOR THIS STRATEGY (their words; only a view marked confirmed, or said as theirs, is theirs)', ...lines, ''] : ['THEIR STORIES AND VIEWS, GIVEN IN THE CHAT FOR THIS STRATEGY', '(none beyond their answers)', '']
}
// The field research done before the posts were chosen, as lines a prompt can cite by id.
export function fieldLines(field, ids = null) {
  const xs = (field?.findings || []).filter((f) => f && f.id && (!ids || ids.includes(f.id)))
  return xs.map((f) => `${f.id} [${f.gives || 'finding'}] ${f.title || ''}: ${f.what || ''}${f.use ? ` Use: ${f.use}` : ''}${f.relates ? ` Relates to their view: ${f.relates}` : ''}${f.url ? ` (${f.source || 'source'}, ${f.url})` : ''}`)
}

// Step 1: mine everything they've said and choose the publication and ten posts.
export function substackChoosePrompt(work, answers, methods, today = '', extra = {}) {
  const examples = work.builders?.substack?.examples || []
  const field = extra.field || null
  return {
    system: methods._voice,
    prompt: [
      methods.substack,
      ...examplesFor(methods),
      '',
      NOT_EXHAUSTIVE,
      '',
      today ? `Today is ${today}. Every date you write is a real date counted from today, never a placeholder such as [date].` : '',
      '',
      contextFor(work, 'substack'),
      '',
      'THEIR ANSWERS FOR THIS BUILDER',
      answersText(BY_ID.substack, answers) || '(none)',
      '',
      ...(examples.length ? ['PUBLIC SUBSTACKS THEY LOOKED AT IN THE CHAT (read there; use only these names in "studied")', JSON.stringify(examples), ''] : []),
      ...materialBlock(work.builders?.substack),
      ...(field?.findings?.length ? ['RESEARCH INTO THEIR FIELD, DONE FOR THIS STRATEGY (pages opened and read; cite a finding by its id in "builds")', ...fieldLines(field), ''] : ['RESEARCH INTO THEIR FIELD', '(none could be done; work from what they have told you)', '']),
      ...(extra.notes ? ['AN EDITOR READ YOUR FIRST TEN POSTS AND ASKS FOR THESE CHANGES', extra.notes, ''] : []),
      'This step chooses their publication and its ten posts. A researcher has already looked into their field (above). Afterwards each post is researched further and its full card is written, so here you choose and outline the posts; you do not write the cards.',
      '1. Mine everything first. Read every answer they have given: what they do now, work they have led, what people come to them for, what they know, life outside work, something they would love to try, who they know, more of this and less of this, the offer, their First 10 Customers plan, their Substack answers and the stories and views they gave in the chat. List every usable story, phrase, habit, number, opinion and personal detail in "material", each with where it came from. The best posts usually come from the answers they thought were off-topic, and from everyday material: something they noticed, a conversation, a mistake, a decision, an opinion they changed.',
      '2. Choose ten posts that each add something distinct for their reader. Use the moves and the guidance for a set of ten (method 5a) as prompts for your judgment, not as quotas or a checklist. Post 1 introduces them. Mix posts that show their method with posts that build an audience. Vary how their expertise shows: a story, an analysis, an observation, an opinion they hold, a prediction, a demonstration, a researched example, an interview, a guide, or a form of your own. Avoid ten versions of the same instructional post, predictable hooks, interchangeable advice and repeated structures; their own observations, language, humour and judgments should shape each post. Let each story carry the post it serves best rather than leaning on the same few stories; where they have no story for a post, choose an angle that needs none. A named thing, numbers of their own, a bridge from their life outside work and one open-door post late in the set usually serve them well: include them when they fit this person.',
      '3. Develop their point of view. Where their answers or the views they gave in the chat show a belief, a disagreement, a prediction or a changed mind, build a post on it with a clear argument: what they believe, why (what they have seen), what the reader should see or do differently, and when it might not apply. Hot takes, contrarian arguments and predictions belong only where they have shown a perspective worth developing. Never manufacture controversy and never give them a belief, opinion or experience they have not expressed or confirmed; if an angle would need a view they have not endorsed, choose an angle that works with what they have shared. "Authenticity matters" is not a point of view; what they believe, why, and what changes for the reader is.',
      '4. Use the field research where it makes a post better: a reader question as the hook, a tension or surprising finding as the argument, an example to analyse, evidence that supports, challenges or sharpens their view. Put the ids a post uses in "builds". Research never replaces their own material and never stands in for their experience.',
      '5. The offer fits the argument: a post\'s perspective shows their expertise and gives the right reader a reason to consider their help. Not every post is a pitch.',
      '6. Headlines sound like them and like this post. A number, a confession, a name or a mild provocation often works (method 5a, Headlines); a formula repeated ten times does not. Each subtitle adds the stakes.',
      '7. Each post\'s "angle" is two to four flowing sentences in the strategist\'s voice, specific enough for a card writer to develop without guessing: the argument or the story, the material at its centre, and why a reader will care. Never a label or a topic.',
      '8. Status: "ready" when everything it needs is in what they have told you; "needs a detail" when one fact or permission only they can supply is missing (never whether a view is theirs: a post rests only on views they hold); "do this first" when they must do something before they can write it (run the tasting, ask a client, check their contract). Say exactly what in "needsFirst". These are often the best posts.',
      '9. The publication, the footer and the order note are flowing prose (method: how you talk to them). The named thing lists the post numbers it appears in; the series names its first post. The footer and every ask use only confirmed details of their call or offer, matched to the offer\'s stage (method 5b). A booking link they have not given is written [add your booking link].',
      '10. Then the rest of the strategy, as the shape asks: their reader, their world, series, voice, what to become known for, names, branding, sharing, Notes, signals and the Substacks they studied. Write it in full, connected sentences; each "gist" is one plain sentence to them as "you".',
      'Never invent a story, client, result, quote, number, opinion or link. A scene you imagine is labelled as imagined.',
      'Return exactly this JSON shape, and nothing else:',
      SHAPES.substack3,
    ].join('\n'),
  }
}

// The research helper (one agent type, 12 Nov): each task says what to find and the JSON to reply with.
export const postResearchSystem = () => [
  'You research for an Uncapped customer\'s Substack strategy: their field, their readers and the posts they will write. You are not writing anything for the customer to read. Each task says what to find and the JSON to reply with.',
  'Think like a strategist preparing to help this particular person write something distinctive. Their field is their own: do not assume it resembles any other business or any example you know. Search widely and independently; do not stop at the first site that covers a topic.',
  'Rules: open every page with WebFetch before you use it, and give its link exactly as you opened it. If a page fails or needs a login, leave it out and list it under couldntRead. Prefer original and reputable sources (the study itself, official guidance, the trade press, the writer\'s own post, a real community thread) over content farms. A quote whose origin is disputed is described as "usually credited to". A statistic names its source and year. Never hold up a real small business as a bad example. Summarise; quote a source in a few words at most.',
  'Do not message the customer, publish anything or change any file. When you are done, reply with ONLY the JSON the task asks for and nothing else (no code block).',
].join('\n')
const GIVES = 'tension | example | reader question | finding | point of view | cultural moment'
const offerLine = (work) => { const o = activeOffer(work); return o ? `The customer's offer: ${o.name}${o.buyer ? `, for ${o.buyer}` : ''}${o.problem ? `. The problem it solves: ${o.problem}` : ''}.` : '' }

// Step 1 (12 Nov): the field, before any post is chosen.
export function fieldResearchPrompt(work, answers, today = '') {
  const d = work.discover?.answers || {}
  const lines = materialLines(work.builders?.substack)
  const say = (label, v) => (String(v || '').trim() ? `${label}: ${String(v).trim().slice(0, 900)}` : '')
  return [
    today ? `Today is ${today}.` : '',
    offerLine(work),
    say('Who they want to write for', answers?.reach),
    say('What they do now', d.now),
    say('Work they have led', d.led),
    say('What people come to them for', d.askedFor),
    say('What they know', d.know),
    say('What they keep noticing in their field', answers?.belief),
    lines.length ? `Their stories and views, in their words:\n${lines.join('\n')}` : '',
    '',
    'TASK: investigate this person\'s world before their Substack posts are chosen. Find out who their reader is and what that reader is dealing with right now; the conversations those readers are having (forums, community threads, comments, trade press, news, studies, official guidance); what is changing in their industry; the advice everyone in their field repeats and where it is contested; and examples a writer could analyse. Look for what would help this person write something with something to say: a tension, a specific example, a reader question in readers\' own words, a surprising finding, an informed point of view, or a cultural moment their reader would recognise. Where they have shared a view, look for what supports, challenges or complicates it.',
    'Return 8 to 14 findings from a range of sources: no single site for more than two findings unless it is uniquely authoritative. Use at most 10 searches and 14 page reads.',
    `Reply with ONLY this JSON: {"findings": [{"id": "f1", "gives": "${GIVES}", "title": "a short name for it", "what": "what the source says, summarised in one or two sentences, with its date or year when it matters", "use": "one or two sentences: how a post by this person could use it", "relates": "which of their views or stories it supports, challenges or sharpens, and how; empty if none", "url": "the link exactly as you opened it", "source": "the site's name", "date": "the page's date if shown, else empty"}], "couldntRead": ["a link that failed"]}`,
  ].filter((x) => x !== '').join('\n')
}

// Step 4: deeper research for a group of posts, with the field findings in hand.
export function postResearchPrompt(work, out, posts, today = '', field = null, avoid = []) {
  const pub = out.publication || {}
  const f = fieldLines(field)
  return [
    today ? `Today is ${today}.` : '',
    offerLine(work),
    pub.whoFor ? `Their reader: ${pub.whoFor}` : '',
    f.length ? `Research already done into their field (cite one by its id in fieldIds instead of searching for it again):\n${f.join('\n')}` : '',
    avoid.length ? `Pages already used for other posts (use one again only if it is clearly the best source for this post): ${avoid.join(' ')}` : '',
    '',
    'Posts to research:',
    ...posts.map((x) => {
      const i = typeof x === 'object' ? x.i : x
      const p = out.pieces[i] || {}
      return `Post ${i + 1}: "${p.headline || ''}"${p.subtitle ? ` (${p.subtitle})` : ''}. ${p.form || p.type || ''}${p.move ? `, ${p.move}` : ''}. ${p.angle || ''}${typeof x === 'object' && x.lookFor ? ` LOOK FOR: ${x.lookFor}` : ''}`
    }),
    '',
    'TASK: for each post, find what would make that particular post better to write: a tension, a specific example, a reader question, a surprising finding, an informed point of view or a cultural moment the reader would recognise; and one to three pieces worth reading before writing it (writers, publications or industry sources in their field or the next one over that handle a similar idea or format well). Go beyond the field research for this post\'s specific angle, and point to a field finding by id when it is the best fit. Add only what genuinely helps the post: a post that needs nothing more gets nothing more. Do not reuse one page across posts unless it is the best source for each.',
    'Use at most 4 searches and 6 page reads per post. Work through the posts in order.',
    `Reply with ONLY this JSON: {"posts": [{"post": 1, "items": [{"gives": "${GIVES}", "name": "a short name for it", "what": "what the source says, summarised", "use": "how this post could use it, in one or two sentences", "url": "the link exactly as you opened it", "source": "the site's name", "date": "if shown"}], "reads": [{"author": "the writer or publication", "title": "the piece", "borrow": "what to borrow from it for this post", "url": "the link exactly as you opened it", "source": "the site's name"}], "fieldIds": ["f2"], "couldntRead": ["a link that failed"]}]}`,
  ].filter((x) => x !== '').join('\n')
}

// Step 3 (12 Nov): an editor reads the ten chosen posts. Judgment, not counts.
export function stubReviewPrompt(work, out, answers) {
  const pieces = out.pieces || []
  return {
    system: 'You are the editor of an Uncapped customer\'s Substack strategy. You read the ten posts a strategist chose and judge them as an editor would. You write JSON only.',
    prompt: [
      contextFor(work, 'substack'),
      '',
      'THEIR ANSWERS FOR THE SUBSTACK BUILDER',
      answersText(BY_ID.substack, answers) || '(none)',
      '',
      ...materialBlock(work.builders?.substack),
      'THE TEN POSTS CHOSEN',
      ...pieces.map((p, n) => `${n + 1}. "${p.headline || ''}"${p.subtitle ? ` (${p.subtitle})` : ''} [form: ${p.form || p.type || '?'}; move: ${p.move || '?'}; status: ${p.status || '?'}] ${p.angle || ''}${(p.uses || []).length ? ` Uses: ${(p.uses || []).join('; ')}.` : ''}`),
      '',
      'Read the set as an editor, using judgment rather than counts. Does it read as ten distinct posts, or as variations of one: the same form, the same hook, the same structure, the same few stories? Does each post add something distinct for the reader? Does each post\'s structure suit its idea? Does any post rest on a belief, opinion or experience the person has not expressed or confirmed in their answers or the views above, or invent something? Is there a perspective of theirs in the material that the set ignores and that would make a stronger post? Does the offer fit the argument without every post becoming a pitch?',
      'Ask for a revision only when it would materially improve the set; polish is not a reason. A post resting on a view they have not endorsed always needs changing to an angle that works with what they have shared.',
      'Return exactly this JSON: {"verdict": "keep | revise", "overall": "two or three sentences on the set", "notes": [{"post": 3, "issue": "what is wrong with it, specifically", "change": "what to do instead, specifically"}]}',
    ].join('\n'),
  }
}
// The revision the editor asked for: only the posts and their order note.
export function reviseStubsPrompt(work, answers, methods, today, field, out, review) {
  const base = substackChoosePrompt(work, answers, methods, today, { field, notes: [review.overall, ...(review.notes || []).map((x) => `Post ${x.post}: ${x.issue} ${x.change}`)].filter(Boolean).join('\n') })
  return {
    system: base.system,
    prompt: base.prompt.replace(/Return exactly this JSON shape, and nothing else:\n[\s\S]*$/, '') + [
      '',
      'YOUR FIRST TEN POSTS (keep what the editor did not question)',
      JSON.stringify((out.pieces || []).map((p) => ({ headline: p.headline, subtitle: p.subtitle, type: p.type, move: p.move, form: p.form, builds: p.builds, status: p.status, angle: p.angle, uses: p.uses, needsFirst: p.needsFirst, ask: p.ask }))),
      '',
      'Return the ten posts again with the editor\'s changes made, and the order note, as exactly this JSON and nothing else:',
      `{"orderNote": "one flowing paragraph", "pieces": ${V3_PIECE}}`,
    ].join('\n'),
  }
}

// Step 5 (12 Nov): one review of every post's references together, before any card is written.
export function refsReviewPrompt(out, field) {
  const pieces = out.pieces || []
  const f = new Map((field?.findings || []).map((x) => [x.id, x]))
  const dom = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').split('/')[0]
  const lines = pieces.flatMap((p, n) => {
    const r = p.research || {}
    const refs = [
      ...(r.makeItFun || []).map((x, k) => `   p${n + 1}.i${k + 1} [${x.kind || 'example'}] ${x.name}: ${x.use || ''} (${dom(x.url)})`),
      ...(r.inspiration || []).map((x, k) => `   p${n + 1}.r${k + 1} [to read] ${x.author || ''}, "${x.title || ''}": ${x.borrow || ''} (${dom(x.url)})`),
      ...[...new Set([...(p.builds || []), ...(r.field || [])])].filter((id) => f.has(id)).map((id) => `   ${id} [${f.get(id).gives || 'finding'}] ${f.get(id).title || ''}: ${f.get(id).use || f.get(id).what || ''} (${dom(f.get(id).url)})`),
    ]
    return [`Post ${n + 1}: "${p.headline || ''}" [${p.form || p.type || ''}] ${p.angle || ''}`, ...(refs.length ? refs : ['   (no references found)'])]
  })
  return {
    system: 'You review the research behind an Uncapped customer\'s ten Substack posts before their cards are written. You write JSON only.',
    prompt: [
      'Each post below has the references research found for it (ids like p3.i1, p3.r2, and field findings like f4).',
      ...lines,
      '',
      'For each post, keep only the references that improve what someone can write for that post: a useful tension, a specific example, a reader question, a surprising finding, an informed point of view, a recognisable moment, or a piece genuinely worth reading first. Say in a few words what each kept one gives this post. A source that appears in several posts stays only in the posts where it is the best fit. Do not drop a good reference just to vary sources, and do not keep a weak one to fill space: a post can have none.',
      'Mark a post "thin" only when a specific kind of material would clearly make it better and research could find it; say exactly what to look for.',
      'Return exactly this JSON: {"posts": [{"post": 1, "keep": [{"ref": "p1.i1", "why": "what it gives this post"}], "thin": false, "lookFor": ""}]}',
    ].join('\n'),
  }
}
// Applies the review to one post's research: only what was kept, field findings brought in as items.
export function keepReviewed(p, n, rv, field) {
  const r = p.research || {}
  const keep = new Map((rv?.keep || []).map((x) => [String(x.ref || '').trim(), String(x.why || '').trim()]))
  const f = new Map((field?.findings || []).map((x) => [x.id, x]))
  const fun = (r.makeItFun || []).filter((x, k) => keep.has(`p${n + 1}.i${k + 1}`))
  const read = (r.inspiration || []).filter((x, k) => keep.has(`p${n + 1}.r${k + 1}`))
  const fromField = [...keep.keys()].filter((id) => f.has(id)).map((id) => { const x = f.get(id); return { name: x.title || '', use: [x.what, x.use].filter(Boolean).join(' '), url: x.url || '', source: x.source || '', kind: x.gives || 'finding', field: id } })
  return { ...r, makeItFun: [...fun, ...fromField].slice(0, 4), inspiration: read.slice(0, 3), reviewed: true, thin: Boolean(rv?.thin), lookFor: String(rv?.lookFor || '').trim() }
}

// Step 6: one post's full card.
export function postCardPrompt(work, out, i, methods, refs, today = '', field = null) {
  const pieces = out.pieces || []
  const x = pieces[i] || {}
  const keep = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] != null).map((k) => [k, o[k]]))
  const strategy = keep(out, ['forOffer', 'publication', 'footer', 'orderNote', 'reader', 'voice', 'knownFor', 'job', 'call', 'offerMention', 'material'])
  const stub = keep(x, ['headline', 'subtitle', 'type', 'move', 'form', 'status', 'angle', 'uses', 'needsFirst', 'ask'])
  const r = refs && ((refs.makeItFun || []).length || (refs.inspiration || []).length) ? refs : null
  return {
    system: methods._voice,
    prompt: [
      methods.substack,
      ...examplesFor(methods),
      '',
      NOT_EXHAUSTIVE,
      '',
      today ? `Today is ${today}.` : '',
      '',
      contextFor(work, 'substack'),
      '',
      'THEIR ANSWERS FOR THE SUBSTACK BUILDER',
      answersText(BY_ID.substack, work.builders?.substack?.answers) || '(none)',
      '',
      ...materialBlock(work.builders?.substack),
      'THEIR SUBSTACK STRATEGY, CHOSEN EARLIER',
      JSON.stringify(strategy),
      '',
      'THE TEN POSTS, IN PUBLISHING ORDER',
      ...pieces.map((p, n) => `${n + 1}. [${p.form || p.type || 'post'}; ${p.move || ''}] ${p.headline || ''}${n === i ? '   <- THIS POST' : ''}`),
      '',
      `THE POST TO WRITE THE CARD FOR (post ${i + 1} of ${pieces.length})`,
      JSON.stringify(stub),
      '',
      r ? 'RESEARCH FOR THIS POST, OPENED, READ AND REVIEWED (use url and source exactly as given)' : 'RESEARCH FOR THIS POST',
      r ? JSON.stringify({ makeItFun: r.makeItFun || [], inspiration: r.inspiration || [] }) : 'Research found nothing that would improve this post. Leave "makeItFun" and "inspiration" empty; where an outside reference would help, say in "toAdd" exactly what kind to look for. Never invent a link.',
      '',
      `Write the full card for post ${i + 1} (method 5d), at the depth, in the voice and with the care of the worked example cards: copy their level, never their content, topics, people, sources or structure. Every field is flowing prose from a creative director and editorial strategist sitting across the table from them, pleased about the idea, talking to them as "you". Never a run of short, clipped sentences or noun fragments. No em dashes or en dashes. None of the banned phrases (method: how you talk to them).`,
      'Develop the post\'s headline, angle and argument; don\'t change them. Shape the beats to this post\'s own form, as many as it needs: a story moves through scenes, an analysis through the evidence and what it means, a prediction through what is changing, why and what to do about it, a demonstration through its steps, an opinion through the belief, what led them to it, who would disagree and what the reader should see differently. Use a complication, a contrarian turn or a reader action only where it makes this post better.',
      'Keep three kinds of material apart. "makeItFun" and "inspiration" hold only the research above for this post, links exactly as given, each with what it gives this post; leave them empty rather than add a weak one, and never add a source that is not above (the writers named in method 7c and the worked examples included). "yourMaterial" holds what comes from their answers and the stories and views they gave in the chat, with where. "toAdd" holds what only they can supply: where the post would be stronger with their own story or detail, a question built from this post that might jog their memory (a specific situation from their offer, audience or background, then the question), and how to write the post if nothing comes to mind. If the status is "do this first" or "needs a detail", "beforeYouWrite" says exactly what.',
      'Their point of view is theirs: develop what they believe, why, and what the reader should see differently, only from views they have expressed or confirmed. The ending fits the argument and uses the post\'s ask shape and only confirmed details; not every post is a pitch. The standing footer goes after it and is not repeated.',
      'Don\'t write the post or paragraphs they could paste. Never invent a story, result, quote, number, opinion or link. The card must pass the cold-reader test (method 5d): someone reading only this card knows the whole story and what to write.',
      'Return exactly this JSON shape, and nothing else:',
      SHAPES.card,
    ].join('\n'),
  }
}

// Step 7: the floor a card must clear before it's shown: complete, in full
// sentences, honest about its sources. Form, beat counts and how many
// references are judgment, not rules (Gabriela, 12 Nov).
const CARD_SHAPES = ['your next step', 'soft door', 'read to the end']
const BANNED = ["in today's fast-paced world", "let's dive in", "it's worth noting", 'game-changer', 'game changer', 'unlock', 'navigate', 'landscape', 'journey', 'delve', 'elevate']
const sentenceCount = (t) => (String(t || '').match(/[^.!?]+[.!?]+["”’)]*/g) || []).length
export function cardProblems(c) {
  const s = (v) => typeof v === 'string' && v.trim().length > 0
  const p = []
  if (!c || typeof c !== 'object') return ['the whole card']
  if (sentenceCount(c.reader) < 2) p.push('"reader" needs full sentences about one specific person in a specific moment')
  if (sentenceCount(c.problem) < 2) p.push('"problem" needs full sentences: the problem in their terms, what it costs and what they get wrong')
  if (sentenceCount(c.offerFit) < 2) p.push('"offerFit" needs full sentences')
  if (sentenceCount(c.idea) < 2) p.push('"idea" needs a full paragraph in the strategist\'s voice: the argument and why it is theirs to write')
  const arc = Array.isArray(c.arc) ? c.arc : []
  if (arc.length < 2) p.push('the arc needs the beats this post needs, each one a full paragraph')
  if (arc.some((b) => !s(b?.title) || sentenceCount(b?.text) < 2)) p.push('every beat needs a short title and a full paragraph')
  if ((c.makeItFun || []).some((x) => x && s(x.name) && !s(x.use))) p.push('every item in "makeItFun" needs what it gives this post')
  if ((c.inspiration || []).some((x) => x && (s(x.title) || s(x.author)) && !s(x.borrow))) p.push('every piece in "inspiration" needs what to borrow from it')
  if (!c.cta || !s(c.cta.bridge) || !s(c.cta.wording) || !CARD_SHAPES.includes(String(c.cta.shape || '').toLowerCase().trim())) p.push('the ending needs a shape (your next step, soft door or read to the end), a bridge and the full wording')
  const all = JSON.stringify(c)
  if (/[—–]/.test(all)) p.push('no em dashes or en dashes anywhere: rewrite those sentences with commas or full stops')
  const low = all.toLowerCase()
  const hit = BANNED.filter((b) => new RegExp(`\\b${b.replace(/[-']/g, (m) => `\\${m}`)}`).test(low))
  if (hit.length) p.push(`remove these phrases: ${hit.join(', ')}`)
  return p
}

// Keeps only links that this post's research opened, and settles the shapes,
// before a card is saved. Never adds anything.
const normUrl = (u) => String(u || '').trim().replace(/[#?].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/i, '').toLowerCase()
export function cleanCard(stub, card, refs, verified = []) {
  const ok = new Set([...((refs?.makeItFun || []).map((x) => normUrl(x.url))), ...((refs?.inspiration || []).map((x) => normUrl(x.url))), ...verified.map(normUrl)].filter(Boolean))
  const link = (x) => ({ ...x, url: x?.url && ok.has(normUrl(x.url)) ? String(x.url).trim() : '' })
  const dash = (t) => String(t ?? '').replace(/\s*[—–]\s*/g, ', ')
  const deep = (v) => (typeof v === 'string' ? dash(v) : Array.isArray(v) ? v.map(deep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'url' ? x : deep(x)])) : v)
  const c = deep(card || {})
  const shape = String(c.cta?.shape || '').toLowerCase().trim()
  const t = (v) => String(v || '').trim()
  return {
    ...stub,
    reader: t(c.reader),
    problem: t(c.problem),
    offerFit: t(c.offerFit),
    idea: t(c.idea),
    arc: (c.arc || []).filter((b) => b && t(b.text)).map((b) => ({ title: t(b.title).replace(/\.$/, ''), text: t(b.text) })),
    makeItFun: (c.makeItFun || []).filter((x) => x && t(x.name)).slice(0, 4).map(link).map((x) => ({ ...x, kind: t(x.kind).toLowerCase() })),
    inspiration: (c.inspiration || []).filter((x) => x && t(x.borrow || x.title)).slice(0, 3).map(link),
    yourMaterial: (c.yourMaterial || []).filter((x) => x && t(x.item)),
    toAdd: (c.toAdd || []).filter((x) => x && (t(x.what) || t(x.prompt))).map((x) => ({ what: t(x.what), prompt: t(x.prompt), ifNothing: t(x.ifNothing) })),
    beforeYouWrite: t(c.beforeYouWrite),
    cta: { shape: CARD_SHAPES.includes(shape) ? shape : (stub.ask && CARD_SHAPES.includes(String(stub.ask).toLowerCase()) ? String(stub.ask).toLowerCase() : 'your next step'), bridge: t(c.cta?.bridge), wording: t(c.cta?.wording) },
  }
}

// The verified reading list in the method (7c), as links a card may keep.
export const verifiedReading = (methodText) => (String(methodText || '').split('### Verified reading list')[1] || '').split('\n## ')[0].match(/https?:\/\/\S+/g) || []

// A v3 brief also gives three headline options and the card's ending in full.
SHAPES.brief3 = SHAPES.brief.replace(/^\{/, `{
 "headlines": [{"text": "a headline option", "pick": true, "why": "for your pick only: why, in a sentence; empty for the others"}],
 "ending": {"shape": "your next step | soft door | read to the end", "bridge": "the bridge sentence", "wording": "the full ending, ready to copy; [add your booking link] where their link goes"},`)

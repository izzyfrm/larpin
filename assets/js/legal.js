import { config } from './config.js';

// Static, operator-written copy. Nothing user-supplied is interpolated here.
const UPDATED = '12 October 2026';
const contact = `<a href="${config.contactUrl}" rel="noopener">${config.contactLabel}</a>`;

export const terms = `
<p class="legal-meta">Last updated ${UPDATED}</p>
<h1>Terms of Service</h1>
<p class="lede">larpin is a gallery of “larp” media: staged, borrowed or made-up flex pictures and clips, shared as props for jokes, memes and roleplay. These terms are the deal between you and the person who runs larpin (“we”). Using the site means you accept them. If you do not, please do not use it.</p>

<h2>1. What larpin is, and is not</h2>
<p>Everything on larpin is presented as a prop. Nothing here is evidence that anyone owns, earned, bought or did anything. We do not verify that any post shows something real, and you should treat every post as staged.</p>

<h2>2. Who can use it</h2>
<ul>
<li>You must be at least 13. If you are under 18, you need a parent or guardian’s permission.</li>
<li>One person per account. You are responsible for what happens on your account and for keeping your password to yourself.</li>
<li>There is no email on your account, so we cannot reset a forgotten password. Lose it and the account is gone.</li>
<li>Usernames cannot be changed. We may reclaim a username that impersonates someone, squats on a brand, or belongs to a banned account.</li>
</ul>

<h2>3. Content rules</h2>
<p>larpin is an all-ages site. You may not submit, as a post, profile picture, name or bio:</p>
<ul>
<li><strong>Anything sexual or 18+.</strong> No nudity, sexual acts, fetish content, lingerie shots or sexually suggestive posing.</li>
<li><strong>Anything that sexualises or endangers a minor.</strong> This is never tolerated. Material of this kind is locked away from everyone, the account is banned, and we report it to the relevant authorities and keep the records they require.</li>
<li><strong>Real private information.</strong> No readable card or account numbers, government IDs, home addresses, licence plates, phone numbers, or screenshots of private chats that identify a real person.</li>
<li><strong>Other people without consent.</strong> No photos of identifiable strangers, and no post that claims to be, or speaks for, a real person or company.</li>
<li><strong>Forgeries meant to pass as real.</strong> No fake receipts, payment confirmations, bank or wallet screenshots, tickets, IDs, certificates or documents built to be handed to a third party as genuine. A joke image of a stack of cash is a prop. A doctored transfer confirmation is a forgery.</li>
<li><strong>Hate, threats or gore.</strong> No content attacking people for who they are, no threats, no graphic violence or cruelty.</li>
<li><strong>Things you have no right to share.</strong> Only post what you made or are licensed to share.</li>
<li><strong>Malware, spam or ads.</strong> No QR codes or links to scams, no promotion of illegal goods or services.</li>
</ul>

<h2>4. How you may use what you download</h2>
<p>Downloads are for personal, non-commercial fun: memes, group chats, roleplay, obvious jokes. You may not use anything from larpin to:</p>
<ul>
<li>get money, goods, credit, investment, followers-for-sale or services from anyone by making them believe the flex is real;</li>
<li>run or support romance scams, fake giveaways, fake investment or “signals” schemes, or fake sales listings;</li>
<li>pose as a specific real person, or as an employee or customer of a real company;</li>
<li>harass, blackmail or mislead someone in a way that harms them.</li>
</ul>
<p>If you do any of that, you alone are responsible for it. We will ban the accounts involved and co-operate with lawful requests from law enforcement.</p>

<h2>5. Review and moderation</h2>
<ul>
<li>Every submission is held for roughly two minutes and checked by an automated image classifier before it becomes public. Videos are checked through still frames taken from the clip.</li>
<li>Automated review makes mistakes in both directions. A post going live does not mean we endorse it or have confirmed it is allowed; a rejection does not mean we think badly of you.</li>
<li>If the classifier cannot reach a decision, the post stays hidden until a human looks at it. We never publish on a failed check.</li>
<li>Rejected files are deleted from our storage when they are rejected.</li>
<li>Anyone signed in can report a post. We can remove any post and suspend or ban any account that breaks these terms, with or without warning, depending on how serious it is.</li>
<li>Think a decision was wrong? Tell us at ${contact} with your username and the title of the post.</li>
</ul>

<h2>6. Your content and the licence you give us</h2>
<p>You keep ownership of what you submit. By submitting it you give us a worldwide, royalty-free, non-exclusive licence to store it, re-encode it, display it on larpin and let other users view and download it for the uses in section 4. That licence ends when you delete the post or your account, except that copies other people already downloaded are outside our control, and material we are legally required to keep is kept.</p>
<p>You confirm that you have the rights to give that licence and that the content does not break section 3.</p>
<p>Items marked <em>Free</em> come from larpin’s own vault and are offered for the same personal uses in section 4.</p>

<h2>7. Copyright and takedowns</h2>
<p>If something of yours was posted without permission, use the report button on the post and pick “It is mine and was posted without permission”, or write to ${contact}. Tell us which post, what the original work is and where it can be seen, and that you are the owner or act for the owner. We remove content when a complaint looks valid and ban accounts that keep doing it. If your post was removed by mistake, reply with why and we will look again.</p>

<h2>8. Fair use of the service</h2>
<p>Do not scrape the site in bulk, hammer the API, try to get around upload limits or the safety review, probe for other people’s unpublished posts, or interfere with the service. Limits exist (for example, 10 submissions an hour and 5 waiting in review at once) and may change.</p>

<h2>9. No promises</h2>
<p>larpin is a free, hobby-scale service provided “as is”. It may be slow, lose data, change or shut down, and posts may disappear. Keep your own copy of anything you care about. To the fullest extent the law allows, we give no warranties and are not liable for indirect or consequential losses, or for what other users post or what anyone does with a download. Nothing in these terms limits liability that cannot legally be limited, or rights you have as a consumer where you live.</p>

<h2>10. Ending things</h2>
<p>You can delete your account at any time in Settings; that removes your profile and posts straight away. We can suspend or close accounts that break these terms.</p>

<h2>11. Changes</h2>
<p>If we change these terms in a way that matters, the date at the top changes. Carrying on using larpin after that means you accept the new version.</p>

<h2>12. Contact</h2>
<p>Questions, appeals and legal notices: ${contact}.</p>
`;

export const privacy = `
<p class="legal-meta">Last updated ${UPDATED}</p>
<h1>Privacy Policy</h1>
<p class="lede">The short version: larpin has no ads, no analytics, no tracking cookies and never asks for your email. This page lists everything it does hold, why, where, and for how long.</p>

<h2>1. What we collect</h2>
<table>
<thead><tr><th>What</th><th>Why</th><th>Kept until</th></tr></thead>
<tbody>
<tr><td>Username, display name, bio, profile picture</td><td>Your public profile</td><td>You change them or delete your account</td></tr>
<tr><td>Password, stored only as a salted PBKDF2-SHA256 hash</td><td>Signing you in. We cannot read your password.</td><td>You change it or delete your account</td></tr>
<tr><td>Session records (a hash of your sign-in token, with creation and expiry times)</td><td>Keeping you signed in</td><td>You sign out, or 30 days</td></tr>
<tr><td>Posts: the file, title, dimensions, length, time submitted, review result, download count</td><td>Running the gallery</td><td>You delete the post or your account. Rejected files are deleted at rejection.</td></tr>
<tr><td>Review frames: up to six still images taken from a submitted video</td><td>The safety review</td><td>The review finishes</td></tr>
<tr><td>Reports you file: the post, the reason, your note, your account</td><td>Moderation</td><td>The post is deleted; your account link is removed if you delete your account</td></tr>
<tr><td>Rate-limit counters keyed by a salted hash of your IP address, or by your account</td><td>Stopping spam and password guessing</td><td>At most 48 hours</td></tr>
</tbody>
</table>

<h2>2. What we do not collect</h2>
<ul>
<li>No email address, phone number, real name, date of birth or payment details.</li>
<li>No advertising or analytics scripts, and no third-party fonts or embeds that would see your visit.</li>
<li>No raw IP addresses in our database. Only the salted hash above, which we cannot turn back into an address.</li>
<li>No record of which posts you viewed or downloaded. A download adds one to a counter and nothing else.</li>
</ul>

<h2>3. Photo metadata</h2>
<p>When you submit an image through the site, your browser redraws and re-encodes it before it is sent. That removes embedded metadata such as GPS location, camera model and capture time, so it never reaches us. Videos are uploaded as they are, so any metadata inside a video file is stored and downloadable with it. Remove it yourself first if that matters to you. What is visible in the picture itself (a face, a street sign, a screen) is of course still visible.</p>

<h2>4. Automated review</h2>
<p>Each submitted image, each video review frame and each profile picture is sent to an image-classification model run on Cloudflare Workers AI. The model answers with a single category (for example “none” or “sexual”) which decides whether the post is published, rejected or held for a person to check. Your username is not sent with it. This is an automated decision; if you think it got yours wrong, you can ask for a human review at ${contact}.</p>

<h2>5. Storage in your browser</h2>
<p>larpin uses your browser’s local storage, not cookies, for three things: your sign-in token, your theme choice and your autoplay choice. They stay on your device and are cleared when you sign out (the token) or clear site data.</p>

<h2>6. Who else handles data</h2>
<ul>
<li><strong>Cloudflare</strong> runs the API, database, file storage and the review model. Like any host, its network processes your IP address and request details to deliver and protect the service, under Cloudflare’s own privacy policy.</li>
<li><strong>GitHub Pages</strong> serves the site’s pages and the free vault files. GitHub receives your IP address and request details when your browser loads them, under GitHub’s privacy statement.</li>
</ul>
<p>We do not sell, rent or share personal data with anyone else. We will disclose what we hold if a valid legal order requires it, and we report child sexual abuse material to the appropriate authorities along with the records the law requires us to keep.</p>

<h2>7. What is public</h2>
<p>Your username, display name, bio, profile picture, join date and approved posts are visible to everyone, including people who are not signed in. Posts waiting for review, rejected posts and your reports are visible only to you and to moderators.</p>

<h2>8. Your choices and rights</h2>
<ul>
<li><strong>See and correct:</strong> everything on your profile is editable in Settings, and “Your submissions” lists every post we hold from you with its status.</li>
<li><strong>Delete:</strong> deleting a post removes the file and its record immediately. Deleting your account in Settings removes your profile, picture, sessions and every post in one step.</li>
<li><strong>One exception:</strong> material flagged as child sexual abuse material is retained, inaccessible, for legal reporting, even if the account is deleted.</li>
<li><strong>Anything else</strong> (a copy of your data, an objection, a complaint): ask at ${contact}. Depending on where you live you may also have the right to complain to your data protection authority.</li>
</ul>
<p>Short-lived caches at Cloudflare may keep serving a deleted post for up to five minutes, and a replaced profile picture for up to a day. Copies that other people already downloaded cannot be recalled.</p>

<h2>9. Children</h2>
<p>larpin is not for anyone under 13 and we do not knowingly hold accounts for them. If you believe a child under 13 has signed up, tell us at ${contact} and we will delete the account.</p>

<h2>10. Security</h2>
<p>Connections are encrypted with HTTPS. Passwords are hashed with a per-account salt, sign-in tokens are stored only as hashes, and unreviewed uploads can be opened only by their uploader and moderators. No system is perfectly secure; use a password you do not use anywhere else.</p>

<h2>11. Changes</h2>
<p>If we start collecting something new or using data differently, this page and its date change before that happens.</p>
`;

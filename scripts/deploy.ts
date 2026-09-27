// Deploys beluga.surf by hand. Pushes don't deploy (vercel.json turns that off), since each push
// used up several of Vercel's daily builds. This asks Vercel to build `main` as it is on GitHub,
// through a deploy hook, so only pushed commits go out, never unsaved work in this folder.
//
// Set VERCEL_DEPLOY_HOOK_URL in .env.local first: in Vercel, open the project that serves
// beluga.surf, then Settings, Git, Deploy Hooks, and make one for the branch `main`.

import { execFileSync } from "node:child_process";

function git(...args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

async function main(): Promise<void> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL?.trim();
  if (!hook?.startsWith("https://api.vercel.com/")) {
    console.error(
      "Set VERCEL_DEPLOY_HOOK_URL in .env.local to the deploy hook from Vercel (Settings, Git, Deploy Hooks, branch main).",
    );
    process.exit(1);
  }

  // Vercel builds what GitHub holds, so say which commit that is, and what is still only here.
  git("fetch", "--quiet", "origin", "main");
  const pushed = git("log", "-1", "--format=%h %s", "origin/main");
  const waiting = git("rev-list", "--count", "origin/main..HEAD");
  if (waiting && waiting !== "0") {
    console.warn(`${waiting} commit(s) here aren't on GitHub yet, so they won't be in this deploy.`);
  }

  const response = await fetch(hook, { method: "POST" });
  if (!response.ok) {
    console.error(`Vercel refused the deploy (${response.status}): ${(await response.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const { job } = (await response.json()) as { job?: { id?: string; state?: string } };
  console.info(`Deploying ${pushed || "main"}. Vercel job ${job?.id ?? "started"}, ${job?.state ?? "pending"}.`);
  console.info("It takes a few minutes. Follow it in the Vercel dashboard, under Deployments.");
}

void main();

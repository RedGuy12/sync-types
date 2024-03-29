// @ts-check
import hostedGitInfo from "hosted-git-info";
import fileSystem from "node:fs/promises";
import path from "node:path";

const rootPath = process.argv.at(-1);

const oldPackages = JSON.parse(
	await fileSystem.readFile(
		path.resolve(rootPath, "./package-lock.old.json"),
		"utf8",
	),
).packages;
const newPackages = JSON.parse(
	await fileSystem.readFile(
		path.resolve(rootPath, "./package-lock.json"),
		"utf8",
	),
).packages;

const changes = new Set();

for (const packageName in newPackages) {
	const parsedName =
		packageName.split("node_modules/").at(-1) ||
		newPackages[packageName].name;

	if (!oldPackages[packageName]) {
		const addedVersion = newPackages[packageName].version;
		changes.add(
			`- Installed [\`${parsedName}@${addedVersion}\`](https://npmjs.com/package/${parsedName}/v/${addedVersion})`,
		);
		continue;
	}

	const oldVersion = oldPackages[packageName].version;
	const newVersion = newPackages[packageName].version;
	if (oldVersion === newVersion) continue;

	const { repository } = JSON.parse(
		await fileSystem.readFile(
			path.resolve(rootPath, packageName, "./package.json"),
			"utf8",
		),
	);
	const repoLink =
		repository &&
		hostedGitInfo
			.fromUrl(repository.url || repository, {
				noCommittish: true,
				noGitPlus: true,
			})
			.browse(repository.directory);
	const host = repoLink?.split("/")[2];
	const replacement = {
		"github.com": ["tree", "commits"],
		"bitbucket.org": ["src", "history-node"],
		"gitlab.com": ["tree", "commits"],
		"git.sr.ht": ["tree", "logs"],
		"gist.github.com": [/#|\?|$/, "/revisions$&"],
	}[host];
	const commitsLink =
		repoLink && replacement ? repoLink.replace(...replacement) : repoLink;

	changes.add(
		`- Bumped [\`${parsedName}@${oldVersion}\`](https://npmjs.com/package/${parsedName}/v/${oldVersion}) to [\`${newVersion}\`](https://npmjs.com/package/${parsedName}/v/${newVersion})${
			commitsLink ? ` ([see recent commits](${commitsLink}))` : ""
		}`,
	);
}

for (const packageName in oldPackages) {
	if (newPackages[packageName]) continue;

	const parsedName =
		packageName.split("node_modules/").at(-1) ||
		oldPackages[packageName].name;
	const { version } = oldPackages[packageName];
	changes.add(
		`- Removed [\`${parsedName}@${version}\`](https://npmjs.com/package/${parsedName}/v/${version})`,
	);
}

fileSystem.writeFile(
	path.resolve(process.argv.at(-2), "./changes.md"),
	`<details><summary>Changed dependencies</summary>\n\n${
		[...changes].join("\n") || "*No dependencies bumped.*"
	}\n</details>`,
	"utf8",
);

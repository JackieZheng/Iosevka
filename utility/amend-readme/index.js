const fs = require("fs-extra");
const path = require("path");
const parseVariantsData = require("../generate-snapshot-page/parse-variants-data");
const parseLigationData = require("../generate-snapshot-page/ligation-data");
const getCharMapAndSupportedLanguageList = require("../generate-supported-languages/proc");

const charMapPath = process.argv[2];
main().catch(e => {
	console.error(e);
	process.exit(1);
});

/////////////////////////////////////////////////////////////////////////////////////////////////////
async function main() {
	const readmePath = path.resolve(__dirname, "../../README.md");
	let readme = await fs.readFile(readmePath, "utf-8");
	readme = (await processCv()).apply(readme);
	readme = (await processSs()).apply(readme);
	readme = (await processLigSetCherryPicking()).apply(readme);
	readme = (await processLigSetPreDef()).apply(readme);
	readme = (await processLangList()).apply(readme);
	await fs.writeFile(readmePath, readme);
}

async function processSs() {
	const variantsData = await parseVariantsData();
	const md = new MdCol("Section-Stylistic-Sets");
	md.log(`* Styles as stylistic sets:\n`);
	for (const gr of variantsData.ssData) {
		if (!gr.effective) continue;
		md.log(`  * \`${gr.tag}\`: Set character variant to “${gr.description}”.`);
	}
	return md;
}
async function processCv() {
	const variantsData = await parseVariantsData();
	const md = new MdCol("Section-Cherry-Picking-Styles");
	md.log(
		`* Styles for individual characters. They are easy-to-understand names of the \`cv##\` styles, including:\n`
	);
	for (const gr of variantsData.cvData) {
		md.log(`  * Styles for ${gr.descSampleText.map(c => `\`${c}\``).join(", ")}:`);
		const defaults = figureOutDefaults(variantsData, gr);
		for (const config of gr.configs) {
			const tag = config.tag || config.tagItalic;
			md.log(
				`    * \`${config.selector}\`, \`${tag}\`: ` +
					`${config.description}${formatDefaults(config.selector, defaults)}.`
			);
		}
	}
	return md;
}

class MdCol {
	constructor(sectionName) {
		this.data = "";
		this.sectionName = sectionName;
		this.matchRegex = new RegExp(
			`<!-- BEGIN ${sectionName} -->\\n[\\s\\S]*?<!-- END ${sectionName} -->\\n`
		);
	}
	log(...s) {
		this.data += s.join("") + "\n";
	}
	apply(s) {
		return s.replace(this.matchRegex, () => {
			return (
				`<!-- BEGIN ${this.sectionName} -->\n\n` +
				this.data +
				`\n<!-- END ${this.sectionName} -->\n`
			);
		});
	}
}

function formatDefaults(selector, defaults) {
	let dcs = [],
		mask = 0;
	for (const dc of defaults) {
		if (dc.result !== selector) continue;
		dcs.push(dc);
		mask |= dc.mask;
	}
	if (!dcs.length) return "";
	if (mask === 0xf) return ` (default)`;
	if (mask === 0x5) return ` (default for Upright)`;
	if (mask === 0xa) return ` (default for Italic)`;
	if (mask === 0x3) return ` (default for Sans)`;
	if (mask === 0xc) return ` (default for Slab)`;
	return ` (default for ${dcs.map(x => x.desc).join(", ")})`;
}

function figureOutDefaults(variantsData, gr) {
	const defaultConfigs = [
		{
			desc: "Sans Upright",
			mask: 1,
			result: null,
			selector: [...variantsData.default.design, ...variantsData.default.upright]
		},
		{
			desc: "Sans Italic",
			mask: 2,
			result: null,
			selector: [...variantsData.default.design, ...variantsData.default.italic]
		},
		{
			desc: "Slab Upright",
			mask: 4,
			result: null,
			selector: [
				...variantsData.default.design,
				...variantsData.default.upright,
				...variantsData.slabDefaultOverride.design,
				...variantsData.slabDefaultOverride.upright
			]
		},
		{
			desc: "Slab Italic",
			mask: 8,
			result: null,
			selector: [
				...variantsData.default.design,
				...variantsData.default.italic,
				...variantsData.slabDefaultOverride.design,
				...variantsData.slabDefaultOverride.italic
			]
		}
	];

	for (const config of gr.configs) {
		for (const dc of defaultConfigs)
			for (const selector of dc.selector)
				if (config.selector === selector) dc.result = config.selector;
	}
	return defaultConfigs;
}

async function processLigSetCherryPicking() {
	const ligData = await parseLigationData();
	const md = new MdCol("Section-Cherry-Picking-Ligation-Sets");
	md.log(`* Styles for further customizing default (\`calt\`) ligation sets:\n`);
	for (const gr in ligData.cherry) {
		md.log(`  * \`${gr}\`: ${ligData.cherry[gr].desc}.`);
	}
	return md;
}

async function processLigSetPreDef() {
	const ligData = await parseLigationData();
	const md = new MdCol("Section-Cherry-Picking-Predefined");
	md.log(`* Styles for ligation sets, include:\n`);
	for (const gr in ligData.rawSets) {
		if (ligData.rawSets[gr].disableHives) continue;
		const longDesc =
			ligData.rawSets[gr].longDesc ||
			`Default ligation set would be assigned to ${ligData.rawSets[gr].desc}`;
		md.log(`  * \`${gr}\`: ${longDesc}.`);
	}
	return md;
}

async function processLangList() {
	const cl = await getCharMapAndSupportedLanguageList(charMapPath);
	const md = new MdCol("Section-Language-List");
	md.log(`${cl.languages.length} Supported Languages: \n`);
	md.log(cl.languages.join(", "));
	return md;
}

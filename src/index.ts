import fs from "node:fs";
import path from "node:path";
function read(filename: string,): object {
    const data = fs.readFileSync(filename, "utf8");
    return JSON.parse(data);
}
function write(filename: string, content: string | object) {
    fs.writeFileSync(filename, content instanceof Object ? JSON.stringify(content) : content, { encoding: "utf8", flag: "w+" });
}
function deep(dpath: string): string[] {
    if (!fs.existsSync(dpath)) {
        return [];
    }
    return fs.readdirSync(dpath).map(subPath => {
        const fullPath = path.join(dpath, subPath);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            return deep(fullPath);
        }
        return fullPath;
    }).flat();
}

function mkAllDir(dpath: string) {
    path.join(dpath).split(path.sep).reduce((base, cur) => {
        const fullPath = path.join(base, cur);
        if (!fs.existsSync(fullPath) && !cur.includes('.')) {
            fs.mkdirSync(fullPath);
        }
        return fullPath;
    }, ".")
}
function toNewPath(jsonPath: string) {
    return jsonPath.replace(/(?<=[\\/]recipes?[\\/])/, "create_ammo_recipe" + path.sep);
}
type ItemData = {
    item: string;
} | {
    tag: string;
}
interface TaczItemStack {
    item: ItemData;
    count: number;
}
type CreateItemStack = ItemData & {
    count: number;
    nbt?: Object;
}
interface TaczRecipe {
    materials: TaczItemStack[];
    result: {
        type: "ammo" | "gun",
        id: string;
        count: number;
    }
    type: "tacz:gun_smith_table_crafting";
}
interface CreateRecipe {
    type: "create:compacting";
    ingredients: ItemData[];
    results: CreateItemStack[];
}
function createRecipe(oldRecipe: TaczRecipe): CreateRecipe {
    // 处理空值
    oldRecipe.materials.forEach(e => e.count ?? (e.count = 1));
    oldRecipe.result.count ?? (oldRecipe.result.count = 1);
    // 约分
    if (oldRecipe.materials.some(e => e.count > 16)) {
        // console.log(oldRecipe.materials.map(i => i.count));
        const minCount = Math.min(...oldRecipe.materials.map(e => e.count));
        const commonFactors = Array.from<number>({ length: minCount }).fill(0).map((_, i) => oldRecipe.materials.every(e => e.count % (minCount - i) == 0) ? (minCount - i) : 1);
        const commonFactor = Math.max(...commonFactors);
        if (commonFactor > 1) {
            oldRecipe.materials.forEach(m => m.count /= commonFactor);
            oldRecipe.result.count /= commonFactor;
            console.log("约分↓ 系数为 %d", commonFactor);
        }
    }
    // 还大于64就尝试压块
    if (oldRecipe.materials.some(e => e.count > 64)) {
        const ingotsOrGemsPatt = /(?<=(?:forge|c):)(?:ingots|gems)\//;
        oldRecipe.materials
            .filter(e => Object.hasOwn(e.item, "tag") && ingotsOrGemsPatt.test(e.item["tag"]) && e.count > 64)
            .forEach(e => {
                const blockTag = e.item["tag"].replace(ingotsOrGemsPatt, "storage_blocks/");
                const block = { item: { tag: blockTag }, count: Math.floor(e.count / 9) };
                e.count %= 9;
                oldRecipe.materials.push(block);
                console.log("压块↓ %s → %s", e.item["tag"], blockTag);
            });

    }
    // 最终策略：暴力除二，向上取整
    if (oldRecipe.materials.some(e => e.count > 64)) {
        while (oldRecipe.materials.some(e => e.count > 64)) {
            oldRecipe.materials.forEach(e => e.count = Math.round(e.count /= 2));
            oldRecipe.result.count = Math.round(oldRecipe.result.count / 2);
            console.log("暴力除2↓");
        }
    }

    // 锭换板
    oldRecipe.materials.forEach(l => {
        if (Object.hasOwn(l.item, "tag")) {
            l.item["tag"] = (l.item["tag"] as string).replace(/(?<=forge|c):ingots\/copper/, ":plates/copper")
        }
    })
    // 构造机械动力配方
    const n: CreateRecipe = {
        type: "create:compacting",
        ingredients: oldRecipe.materials.map(e => Array.from<ItemData>({ length: e.count }).fill(e.item)).flat(),
        results: [{ item: "tacz:ammo", count: oldRecipe.result.count, nbt: { AmmoId: oldRecipe.result.id } }]
    };
    return n;
}

deep('.').filter(e => /recipes?[\\/].*\.json/.test(e)).forEach(p => {
    const data = read(p) as TaczRecipe;
    if (data.type == "tacz:gun_smith_table_crafting" && data.result.type == "ammo") {
        const np = toNewPath(p);
        mkAllDir(np);
        write(np, createRecipe(data));
        console.log("已完成： %s", np);
    }
})
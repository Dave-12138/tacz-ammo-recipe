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

function toNewPath(jsonPath: string) {
    return jsonPath.replace(/(?<=[\\/]recipes[\\/])/, "create_ammo_recipe" + path.sep);
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
    oldRecipe.materials.forEach(l => {
        if (Object.hasOwn(l.item, "tag")) {
            l.item["tag"] = (l.item['tag'] as string).replace("forge:ingots/copper", "forge:plates/copper")
        }
    })
    const n: CreateRecipe = {
        type: "create:compacting",
        ingredients: oldRecipe.materials.map(e => Array.from<ItemData>({ length: e.count }).fill(e.item)).flat(),
        results: [{ item: "tacz:ammo", count: oldRecipe.result.count, nbt: { AmmoId: oldRecipe.result.id } }]
    };
    return n;
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
deep('.').filter(e => /recipes[\\/].*\.json/.test(e)).forEach(p => {
    const data = read(p) as TaczRecipe;
    if (data.type == "tacz:gun_smith_table_crafting" && data.result.type == "ammo") {
        const np = toNewPath(p);
        mkAllDir(np);
        write(np, createRecipe(data));
    }
})
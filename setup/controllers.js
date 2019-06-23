const fs = require("fs-extra");
const path = require("path");
const yaml = require("yaml");
const recursive = require("recursive-readdir");

const SRC = path.join(__dirname, "..", "src");
let server = fs.readFileSync(path.join(SRC, "server.ts")).toString();

// Controller routes
const controllers = fs.readdirSync(path.join(SRC, "controllers"));
const exportName = [];
controllers.forEach(controller => {
  const controllerFile = fs
    .readFileSync(path.join(SRC, "controllers", controller))
    .toString();
  exportName.push(controllerFile.split("export class ")[1].split(" ")[0]);
});

const importCode = `${exportName
  .map(
    (e, i) =>
      `import { ${e} } from "./controllers/${controllers[i].split(".ts")[0]}";`
  )
  .join("\n")}`;

const insertCode = `
  // start automatic code
  super.addControllers([${exportName.map(e => `new ${e}()`).join(", ")}]);
  // staart-autogenerated
`;
server = importCode + server.replace("// staart:setup/controllers", insertCode);
console.log("✅  Generated paths");

// Redirects
let redirects = [];
try {
  redirects = yaml.parse(
    fs.readFileSync(path.join(SRC, "redirects.yml")).toString()
  );
} catch (error) {
  console.log("✅  Processed no redirect rules");
}

const redirectCode = `
  ${redirects
    .map(
      rule => `
    this.app.get("${rule.split(" ")[0]}", (req, res) => res.redirect("${
        rule.split(" ")[1]
      }"));
  `
    )
    .join("")}
    // staart-autogenerated
`;
server = server.replace("// staart-autogenerated", redirectCode);
if (redirects.length)
  console.log(`✅  Processed ${redirects.length} redirect rules`);

// Static files
recursive(path.join(SRC, "..", "static"))
  .then(files => {
    const staticFiles = files.map(
      file => file.split(path.join(SRC, "..", "static").toString())[1]
    );
    const staticCode = `
      ${staticFiles
        .map(
          staticFile => `
        this.app.get("${staticFile}", (req, res) => res.sendFile(join(__dirname, "..", "static", "${staticFile}")));
      `
        )
        .join("")}
        // staart-autogenerated
    `;
    server = server.replace("// staart-autogenerated", staticCode);
    console.log(`✅  Serving ${staticFiles.length} static files`);
  })
  .catch(() => {})
  .then(() => {
    fs.writeFileSync(path.join(SRC, "app.ts"), server);
    console.log("✅  Generated app.ts file");
    console.log("⌛  Compiling TypeScript");
    process.exit(0);
  });

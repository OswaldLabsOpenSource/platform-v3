const fs = require("fs-extra");
const path = require("path");
const yaml = require("yaml");
const recursive = require("recursive-readdir");
const { success, pending, error } = require("signale");

const SRC = path.join(__dirname, "..", "src");
let server = fs.readFileSync(path.join(SRC, "server.ts")).toString();

const generateControllers = async () => {
  const controllers = (await recursive(path.join(SRC, "controllers"))).map(
    file => file.split(path.join(SRC, "controllers").toString())[1]
  );
  const exportName = [];
  const generatedName = [];
  controllers.forEach((controller, index) => {
    const controllerFile = fs
      .readFileSync(path.join(SRC, "controllers", controller))
      .toString();
    exportName.push(controllerFile.split("export class ")[1].split(" ")[0]);
    generatedName.push(`Controller${index}`);
  });
  const importCode = `${exportName
    .map(
      (e, i) =>
        `import { ${e} as ${generatedName[i]} } from "./controllers${
          controllers[i].split(".ts")[0]
        }";`
    )
    .join("\n")}`;
  const insertCode = `
    // start automatic code
    super.addControllers([${generatedName.map(e => `new ${e}()`).join(", ")}]);
    // staart-autogenerated
  `;
  server =
    importCode + server.replace("// staart:setup/controllers", insertCode);
  success("Generated paths");
};

const generateRedirects = async () => {
  let redirects = [];
  try {
    redirects = yaml.parse(
      fs.readFileSync(path.join(SRC, "redirects.yml")).toString()
    );
  } catch (error) {
    success("Processed no redirect rules");
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
  if (redirects.length) success(`Processed ${redirects.length} redirect rules`);
};

const generateCrons = async () => {
  const crons = fs.readdirSync(path.join(SRC, "crons"));
  const cronImport = crons
    .map(
      cronFile =>
        `import cron_${cronFile.split(".ts")[0]} from "./crons/${
          cronFile.split(".ts")[0]
        }";`
    )
    .join("\n");
  const cronCode = `
  ${crons.map(cronFile => `cron_${cronFile.split(".ts")[0]}();`).join("")}
  `;
  server = cronImport + "\n" + cronCode + "\n" + server;
  if (crons.length) success(`Setup ${crons.length} cron jobs`);
};

const generateStaticFiles = async () => {
  const files = await recursive(path.join(SRC, "..", "static"));
  const staticFiles = files.map(
    file => file.split(path.join(SRC, "..", "static").toString())[1]
  );
  const staticCode = `
    ${staticFiles
      .map(
        staticFile => `
      this.app.get("${staticFile}", (req, res) => res.sendFile(join(__dirname, "..", "..", "static", "${staticFile}")));
    `
      )
      .join("")}
      // staart-autogenerated
  `;
  server = server.replace("// staart-autogenerated", staticCode);
  success(`Serving ${staticFiles.length} static files`);
};

const writeServerFile = async () => {
  await fs.writeFile(
    path.join(SRC, "app.ts"),
    server.replace("// staart-autogenerated", "")
  );
  success("Generated app.ts file");
};

const setup = async () => {
  await generateControllers();
  await generateRedirects();
  await generateCrons();
  await generateStaticFiles();
  await writeServerFile();
};

setup()
  .then(() => {
    pending("Compiling TypeScript");
    process.exit(0);
  })
  .catch(err => error("Error in setup", err));

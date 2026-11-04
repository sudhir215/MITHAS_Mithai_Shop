import {emitKeypressEvents} from "node:readline";
import {createInterface} from "node:readline/promises";
import {stdin, stdout} from "node:process";
import {hash} from "@node-rs/argon2";
import {env} from "../src/config/env.js";
import {createPrismaClient} from "../src/config/prisma.js";
import {ARGON2_OPTIONS, provisionAdminSchema} from "../src/middleware/adminAuth.js";

async function promptSecret(label) {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Admin provisioning requires an interactive terminal");
  }

  stdout.write(label);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.off("keypress", onKeypress);
      stdin.setRawMode(false);
      stdout.write("\n");
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Admin provisioning cancelled"));
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
      } else if (key.name === "backspace") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        }
      } else if (!key.ctrl && !key.meta && character) {
        value += character;
        stdout.write("*");
      }
    };

    stdin.on("keypress", onKeypress);
  });
}

async function main() {
  if (!env.DIRECT_URL) {
    throw new Error("DIRECT_URL must be configured for secure admin provisioning");
  }

  const prompt = createInterface({input: stdin, output: stdout});
  let email;
  try {
    email = await prompt.question("Admin email: ");
  } finally {
    prompt.close();
  }

  const password = await promptSecret("Admin password (12-128 characters): ");
  const confirmation = await promptSecret("Confirm password: ");
  if (password !== confirmation) {
    throw new Error("Passwords do not match");
  }

  const parsed = provisionAdminSchema.safeParse({email, password});
  if (!parsed.success) {
    throw new Error("Email or password does not meet the provisioning requirements");
  }

  const prisma = createPrismaClient({connectionString: env.DIRECT_URL});
  try {
    const passwordHash = await hash(parsed.data.password, ARGON2_OPTIONS);
    const admin = await prisma.admin.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        role: "OWNER",
      },
      select: {id: true, email: true, role: true},
    });
    console.info(`Provisioned ${admin.role} account ${admin.email}.`);
  } catch (error) {
    if (error.code === "P2002") {
      throw new Error("An admin account with that email already exists");
    }
    throw new Error("Admin provisioning failed; inspect secure server logs");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

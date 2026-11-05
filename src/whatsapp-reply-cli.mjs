import { replyCommand } from "./whatsapp-reply.mjs";

const [command, dir, name, ...args] = process.argv.slice(2);
try {
  console.log(JSON.stringify(replyCommand(command, dir, name, args), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

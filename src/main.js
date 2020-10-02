// loads config
const config = require('./lib/config');
var pref = config.CMD_PREFIX;

const {init:Crom} = require('./lib/Crom');
const AdminCmd = require('./lib/AdminCmd');
const {init:Verifier} = require('./lib/Verifier');

// loads module and handlers
const Scpper = require('scpper2.js');
const scpClient = new Scpper.Scpper({site:config.SCP_SITE});
scpClient.config = config;

const Discord = require('discord.js');
const disClient = new Discord.Client({ autoReconnect: true });
disClient.login(config.DIS_TOKEN);
disClient.config = config;

disClient.on("ready", () => {
  console.log(`Logged into ${disClient.user.tag}.`)
})

// handles administrative commands
disClient.on("message", msg => {
  if (!msg.content.toLowerCase().startsWith(pref)||msg.content.toLowerCase().startsWith(pref+'verify')) return;
  let access = 0;
  if (config.DIS_ADMINS instanceof Array) {
    for (role of config.DIS_ADMINS) {
      if (msg.member.roles.cache.has(role)) { access += 1; }
    }
  } else if (config.DIS_ADMINS instanceof String) {
    if (msg.member.roles.cache.has(config.DIS_ADMINS)) { access += 1; }
  }
  if (!access) {
    msg.channel.send("你沒有使用此指令的權限。\nYou do not have the permissions to use this command.");
    return;
  }
  let cmdHandler = new AdminCmd(disClient, msg)
  if (typeof cmdHandler['cmd__'+cmdHandler.cmd] === 'function') { cmdHandler['cmd__'+cmdHandler.cmd]() }
  else { msg.channel.send(`指令不存在。使用 "${pref} help" 尋找更多資料。\nInvalid command. See "${pref} help" for more information.`) }
})

// handles inline query
var crom = Crom({discord:disClient});

// verifies user to be a member by adding a reaction to specific message or checking their wikidot name
var verifier = Verifier({
  scpper: scpClient,
  discord: disClient,
});

// ban malicious user warned by other servers
disClient.on("guildMemberAdd", gm => {
  if (config.DIS_BAN.includes(gm.id)) { gm.ban() }
})

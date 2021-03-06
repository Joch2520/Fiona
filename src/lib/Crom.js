const got = require('got');
const branchUrls = require('./branch');

/**
 * Interacter with Crom wiki crawler api.
 */
class Crom {
  constructor() {
    this.base = `https://api.crom.avn.sh/graphql`
  }
  async req(query) {
    return await got.post(this.base, {
      json: {
        query: query.trim()
      }
    }).json()
  }

  async searchPages(query, filter) {
    return await this.req(`
      {
        searchPages(query: "${query}", filter: {
          anyBaseUrl: ${ !!filter && !!filter.anyBaseUrl ? `"${filter.anyBaseUrl}"` : null }
        }) {
          url
          wikidotInfo {
            title
            rating
          }
          alternateTitles {
            type
            title
          }
          translationOf {
            wikidotInfo {
              title
              rating
            }
          }
        }
      }
      `)
  }

  async searchUsers(query, filter) {
    return await this.req(`
      {
        searchUsers(query: "${query}", filter: {
          anyBaseUrl: ${ !!filter && !!filter.anyBaseUrl ? `"${filter.anyBaseUrl}"` : null }
        }) {
          name
          authorInfos {
            authorPage {
              url
            }
          }
          statistics${ !!filter && !!filter.baseUrl ? `(baseUrl: "${filter.baseUrl}")` : "" } {
            rank
            totalRating
            meanRating
            pageCount
          }
        }
      }
      `)
  }
}

module.exports.Crom = Crom;
module.exports.init = ({discord}) => {
  let config = discord.config;
  let crom = new Crom()
  discord.on("message", async msg => {
    if (msg.author.id==discord.user.id) return;
    try {
      if (/\[{3}.+\]{3}/gi.test(msg.content)||/\{.+\}/gi.test(msg.content)) {
        let rel = [...msg.content.matchAll(/\[{3}((?<branch>[a-zA-Z]{2,3})\|)?(?<queri>[-\w\:]{1,60})\]{3}/gi)];
        let query = [...msg.content.matchAll(/\{(\[(?<branch>[a-zA-Z]{2,3})\])?(?<queri>.+)\}/gi)];
        let reply = [];
        for (var i = 0; i < rel.length; i++) {
          let {queri, branch} = rel[i].groups
          branch = branch ? branch.toLowerCase() : undefined
          reply.push(`${!!branch&&!!branchUrls[branch] ? branchUrls[branch] : branchUrls[config.SCP_SITE]}/${queri}`)
        }
        for (var i = 0; i < query.length; i++) {
          let {queri, branch} = query[i].groups
          branch = branch ? branch.toLowerCase() : undefined
          let res = await crom.searchPages(queri, {
            anyBaseUrl: !!branch&&!!branchUrls[branch] ? branchUrls[branch] : branchUrls[config.SCP_SITE]
          });
          res = res.data.searchPages
          if (res.length) {
            let ans = res[0].wikidotInfo ? res[0].wikidotInfo.title : '' ;
            ans += ans && res[0].alternateTitles.length ? ' - ' : '';
            ans += res[0].alternateTitles.length ? res[0].alternateTitles[0].title : '';
            ans += !ans && res[0].translationOf && res[0].translationOf.wikidotInfo ? res[0].translationOf.wikidotInfo.title : '';
            ans += res[0].wikidotInfo ? `\n評分：${res[0].wikidotInfo.rating}` : '' ;
            ans += `\n${res[0].url}`
            reply.push(ans)
          }
        }
        if (reply.length) {
          msg.channel.send(reply.join("\n\n"))
        } else {
          msg.channel.send("無結果。")
        }
      } else if (/\&.+\&/gi.test(msg.content)) {
        let query = [...msg.content.matchAll(/\&(\[(?<branch>[a-zA-Z]{2,3})\])?(?<queri>.+)\&/gi)];
        let reply = [];
        for (var i = 0; i < query.length; i++) {
          let {queri, branch} = query[i].groups
          branch = branch ? branch.toLowerCase() : undefined
          let filter = {
            anyBaseUrl: !!branch&&!!branchUrls[branch] ? branchUrls[branch] : branchUrls[config.SCP_SITE],
            baseUrl: !!branch&&!!branchUrls[branch] ? branchUrls[branch] : branchUrls[config.SCP_SITE]
          }
          if (branch&&branch==="all") { filter.anyBaseUrl=null; filter.baseUrl=null; }
          let res = await crom.searchUsers(queri, filter);
          res = res.data.searchUsers
          if (res.length) {
            let ans = res[0].name;
            ans += `: ${!!branch&&(branch==="all"||!!branchUrls[branch]) ? branch.toUpperCase() : config.SCP_SITE.toUpperCase()} #${res[0].statistics.rank}`
            ans += `\n共 ${res[0].statistics.pageCount} 頁面，總評分 ${res[0].statistics.totalRating}，平均分 ${res[0].statistics.meanRating}`
            ans += res[0].authorInfos.length ? `\n作者頁：${res[0].authorInfos[0].authorPage.url}` : ""
            reply.push(ans)
          }
        }
        if (reply.length) {
          msg.channel.send(reply.join("\n\n"))
        } else {
          msg.channel.send("無結果。")
        }
      }
    } catch (e) {
      console.log(e)
    }
  })
}

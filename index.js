const axios = require("axios").default
const cheerio = require("cheerio")
const fs = require("fs")
const readlineSync = require('readline-sync');

// This script is extended/modified version of LucasGenovese's Steam-API (https://github.com/LucasGenovese/Steam-API)
// Enter if you want to fetch only games that you dont own in library
const apiKey = ""
// Copy & paste the Cookie header in one of the requests to steam (f12 or ctrl + shift + I > network > any request)
const cookie = ""
// How many games to fetch?
const fetchNgames = 2600;
// Game list size per request (max 100)
const fetchNgamesStep = 100;
// Wait `filterSleep` seconds every ... filtering.
const filterSleepEvery = 20
// Wait .... seconds every `filterSleepEvery` filtering.
const filterSleep = 5
// Wait .... seconds when error occurs while processing
const processFailWait = 0;
// The fee rate (must be substracted from 100 ad divided by 100, so if the fee is %18 so you should type 0.82)
const fee = 0.82;
// Get cards' profit bigger than ...
const cardProfitThreshold = 0
// Get cards' "min", "avg", "avg2" or "max" profits bigger than "cardProfitThreshold"
const cardProfitThresholdVariable = "min"
// Example: if cards' "min" (cardProfitThresholdVariable) profit >= 0.0 (cardProfitThreshold), then get this game!,
// Get cards' quantity bigger than ...
const cardQuantityThreshold = 25
// If card has fewer than `cardQuantityThreshold` quantity, should it subtract its price from profits?
const subtractNoCards = false;
// The limit value for standart deviation of profits.
const riskSDThreshold = 0.7
// It is for calculating more precise "avarage" profit & enables "recommending", if card drop count <= `cardPermutationThreshold`
// it will permutate possible card drops and calculate every single profits
const cardPermutationThreshold = 4
// The file that will results be saved 
const fileName = "results.json";
// Should it write game infos to file?
const saveGameFile = true;
// The file that game infos be saved
const gameFile = "games.json";
// Do you want to log the result to console?
const logResults = true;
// Do you want to write results to file?
const writeResults = true;


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// this function taken from https://stackoverflow.com/questions/23305747/javascript-permutation-generator-with-permutation-length-parameter
function permutation(list, maxLen) {
    // Copy initial values as arrays
    var perm = list.map(function (val) {
        return [val];
    });
    // Our permutation generator
    var generate = function (perm, maxLen, currLen) {
        // Reached desired length
        if (currLen === maxLen) {
            return perm;
        }
        // For each existing permutation
        for (var i = 0, len = perm.length; i < len; i++) {
            var currPerm = perm.shift();
            // Create new permutation
            for (var k = 0; k < list.length; k++) {
                perm.push(currPerm.concat(list[k]));
            }
        }
        // Recurse
        return generate(perm, maxLen, currLen + 1);
    };
    // Start with size 1 because of initial values
    return generate(perm, maxLen, 1);
};
// this function taken from https://stackoverflow.com/questions/7343890/standard-deviation-javascript
function getStandardDeviation(array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}
async function getUserLibrary(id) {
    const res = await axios.get(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${id}`);
    const library = res.data.response.games.map(x => x.appid);
    return library;
}

async function getGameList() {
    let priceList = [];
    let idList = [];
    let priceAndIdList = [];
    let urlContent;
    let filteredURL = "https://store.steampowered.com/search/results/?query"
    // You can add,remove or edit filters as you wish
    // DO NOT ADD "start" AND "count" FILTERS! THEY WILL BE ADDED BELOW
    let filters = {
        dynamic_data: 1,
        sort_by: "Price_ASC",
        snr: "1_7_7_230_7",
        maxprice: 10,
        category1: 998,
        category2: 29,
        hidef2p: 1,
        ndl: 1,
        infinite: 1
    }
    for (var filter of Object.keys(filters)) {
        filteredURL += `&${filter}=${filters[filter]}`
    }
    let fetchTimes = Math.round(fetchNgames / fetchNgamesStep)
    let ETA = fetchTimes + fetchTimes * 0.55
    const now = Date.now();
    console.log(`[!] Started retrieving games, estimated time of retieving is '${Math.round(ETA)}' seconds.`)
    for (var i = 0; i < fetchTimes; i++) {
        var tempURL = filteredURL + "&start=" + (i * fetchNgamesStep) + "&count=" + ((i + 1) * fetchNgamesStep)
        var response = await axios.get(tempURL);
        urlContent += response.data?.results_html || "";
        console.log(`${i * fetchNgamesStep}-${(i + 1) * fetchNgamesStep}. games fetched! (of ${fetchNgames})`)
        await sleep(1000);
    }

    const $ = cheerio.load(urlContent);
    $('div.col.search_price_discount_combined.responsive_secondrow > div.col.search_price').each(function (i, element) {
        let str = $([...$(this).contents()]
            .find(e => e.type === "text" && $(e).text().trim()))
            .text()
            .trim();
        let match = /\d+(,\d+)?/.exec(str);
        let price = Number(match[0].replace(',', '.'));
        priceList.push(price);
    });

    $('div.col.search_capsule > img').each(function (i, element) {
        let gameId = $(this).first().attr('src').split("/")[5].trim(); // grabs game ID from img src and then trims the ID
        idList.push(gameId);
    });

    for (var i = 0; i < priceList.length; i++) {
        let opt = { id: idList[i], price: priceList[i] }
        if (priceAndIdList.indexOf(opt) == -1) priceAndIdList.push(opt);
    }
    console.log(`[!] Finished retrieving games, passed '${Math.round((Date.now() - now) / 1000)}' seconds.`)
    return priceAndIdList;
}

async function getGameInfo(gameId, gamePrice) {
    try {
        let url = `https://steamcommunity.com/market/search/render?start=0&count=30&search_descriptions=0&sort_column=price&sort_dir=asc&appid=753&category_753_Game%5B%5D=tag_app_${gameId}&category_753_cardborder%5B%5D=tag_cardborder_0&category_753_item_class%5B%5D=tag_item_class_2&norender=1`
        const response = await axios.get(url, {
            'headers': {
                'Cookie': cookie
            }
        })
        let tradingCardPrices = []
        let tradingCards = []

        for (var card of response.data?.results) {
            let obj = { name: card.name, price: parseFloat(card.sell_price_text.replace(",", ".")), qty: parseInt(card.sell_listings), appid: card.asset_description.appid, hashName: card.asset_description.market_hash_name }
            tradingCards.push(obj)
            tradingCardPrices.push(obj.price)
        }
        let gameName = (response.data?.results[0]?.asset_description.type || "NO COOKIES NO GAME NAMES X X").split(' ').slice(0, -2).join(' ');
        // Get card ammount
        let tradingCardAmmount = response.data.total_count;
        let possibleCards = Math.round(tradingCardAmmount / 2);

        // Calculates profits
        let profits = {}
        profits["min"] = parseFloat((tradingCardPrices[0] * possibleCards * fee - gamePrice).toFixed(3));
        profits["avg"] = parseFloat(((tradingCardPrices.reduce((a, b) => a + b, 0) / tradingCardPrices.length) * possibleCards * fee - gamePrice).toFixed(3));
        profits["avg2"] = profits["avg"]
        profits["max"] = parseFloat((tradingCardPrices[tradingCardPrices.length - 1] * possibleCards * fee - gamePrice).toFixed(3));

        let possibleProfits = [];
        let comments = [];
        let possibleProfitsSD = 0;
        let noStock = false;
        // Check for permutations of card prices if possible card count is lower than `cardPermutationThreshold`, because higher card count means higher cpu & ram usage
        if (possibleCards <= cardPermutationThreshold) {
            let permOfCardPrices = permutation(tradingCards, possibleCards)
            for (var perm of permOfCardPrices) {
                let total = 0;
                for (var x of perm) {
                    total += (x.qty >= cardQuantityThreshold && subtractNoCards) ? x.price : -x.price;
                    if (x.qty < cardQuantityThreshold) noStock = true
                }
                possibleProfits.push(total * fee - gamePrice)
            }
            // Add the missed posibilities
            for (var card of Object.values(tradingCards)) {
                possibleProfits.push(card.price * possibleCards * fee - gamePrice)
            }
            possibleProfits = possibleProfits.sort(function (a, b) { return a - b; });
            possibleProfitsSD = getStandardDeviation(possibleProfits);
            profits["avg2"] = parseFloat(((possibleProfits.reduce((a, b) => a + b, 0) / possibleProfits.length)).toFixed(3));
        }
        if (possibleProfits.some(x => x < 0) || profits["min"] < 0) comments.push("LOSS")
        if (possibleProfitsSD > riskSDThreshold) comments.push("RISK")
        if (noStock) comments.push("STOCK")
        // Return game
        return {
            name: gameName,
            price: gamePrice,
            dropCount: possibleCards,
            cardPrices: tradingCardPrices,
            cards: tradingCards,
            profits: profits,
            possibleProfits: possibleProfits,
            comments: comments.join(" "),
            standardDeviation: possibleProfitsSD,
            url: 'https://store.steampowered.com/app/' + gameId,
            id: parseInt(gameId)
        };
    } catch (err) {
        if(err?.response?.status == 429) return "BLOCKED"
        console.log(err)
        return false
    }
}

async function getGames() {
    // Create price & game ID list
    var priceAndIDList = await getGameList();
    let fullList = [];
    let ETA = Math.floor(priceAndIDList.length / filterSleepEvery) * filterSleep
    ETA += (priceAndIDList.length * 0.54 + (priceAndIDList.length / 400 * processFailWait * 4))
    ETA += processFailWait * priceAndIDList.length / 300
    const now = Date.now();
    console.log(`[!] Game info fetching starting, estimated time of fetching is '${Math.round(ETA)}' seconds. `)
    for (let i = 0; i < priceAndIDList.length; i++) {
        // Every filterSleepEvery requests waits filterSleep seconds so it wont block me for attempting too much
        if (i % filterSleepEvery === 0 && i != 0) {
            if (i % 400 == 0) {
                // More caution to anti-block
                await sleep(processFailWait * 4 * 1000)
            } else {
                await sleep(filterSleep * 1000);
            }
        }
        // Retrieves and makes list of profitable games
        let latestNode = await getGameInfo(priceAndIDList[i].id, priceAndIDList[i].price);
        if (latestNode == "BLOCKED") {
            console.log(`[!] You have been blocked by steam due Too Many Requests, it might take at least 6 hours (or you can restart your router if you dont own static IP). The games that have been fetched will be processed now. (${Math.round((Date.now() - now) / 1000)} seconds)`)
            return fullList;
        }
        if (latestNode) {
            fullList.push(latestNode);
            console.log(`${i + 1}/${priceAndIDList.length} - Game fetched successfully!`)
        } else {
            console.log(`${i + 1}/${priceAndIDList.length} - Game couldn't be fetched, waiting ${processFailWait} seconds!`)
            await sleep(processFailWait * 1000);
        }
    }
    console.log(`[!] Finished fetching game infos, passed '${Math.round((Date.now() - now) / 1000)}' seconds.`)
    return fullList;
}
async function processData(list) {
    let gameIDList = []
    if (apiKey != "" && cookie != "") {
        console.log(`Retrieving user library...`);
        gameIDList = await getUserLibrary(cookie.match(/(^|)steamLoginSecure=([^;]+)/g)[0].replace("%7C", "|").split("=")[1].split('|')[0]);
        console.log(`Successfully retrieved user library!`);
    }
    let filteredList = list.filter(function (val) {
        return gameIDList.indexOf(val.id) === -1 && val.profits[cardProfitThresholdVariable] >= cardProfitThreshold;
    });

    return filteredList;

}
async function start() {
    try {
        var finalList;
        var processedList;
        if (!logResults && !writeResults) throw new Error("Please, turn on at least one result option. (logResults or writeResults)");
        if (fs.existsSync(gameFile)) {
            console.log(`Game info file found! (${gameFile})`)
            let answer = readlineSync.question("Do you want to process it directly? (y/n)\n");
            if (answer.toLowerCase() == "y") {
                let file = fs.readFileSync(gameFile)
                processedList = await processData(JSON.parse(file))
            }
        }
        if (processedList === undefined) {
            const date = new Date();
            var ms = date.getTime()
            var hours = date.getHours();
            var minutes = "0" + date.getMinutes();
            var seconds = "0" + date.getSeconds();
            var year = date.getFullYear();
            var month = date.getMonth() + 1;
            var day = date.getDate();
            const formattedTime = `${month}/${day}/${year} ` + hours + ':' + minutes.slice(-2) + ':' + seconds.slice(-2);
            console.log(`Retrieving game list${apiKey && cookie ? " (with user library check)" : ""}... (${formattedTime})`);
            finalList = await getGames();
            console.log("Successfully retrieved game list!");
            if (saveGameFile) {
                fs.writeFileSync(gameFile, JSON.stringify(finalList, null, 4))
                console.log(`Game Info file saved as ${gameFile}`)
            }
            console.log(`It took '${Math.round(Math.round((Date.now() - ms) / 1000))}' seconds.`)
            processedList = await processData(finalList)
        }
        if (processedList.length == 0) {
            console.log('Already have all games in library or no games found by specific filters.')
        }
        console.log("'STOCK' means there are few cards, you might not sell them.");
        console.log("'RISK' for RISKY games may not be profitable if you have bad luck.")
        console.log("'LOSS' for games that might get you in loss. (- profits)")
        if (logResults) {
            let rows = []
            for (obj of processedList) {
                rows.push({ name: obj.name, prc: obj.price, dropCount: obj.dropCount, min: obj.profits.min, avg: obj.profits.avg, avg2: obj.profits.avg2, max: obj.profits.max, comments: obj.comments, sDeviation: parseFloat(obj.standardDeviation.toFixed(3)), id: obj.id })
            }
            console.table(rows)
        }
        if (writeResults) {
            console.log(`Process completed, writing results to ${fileName}`);
            fs.writeFileSync(fileName, JSON.stringify(processedList, null, 4))
            console.log(`Results written to ${fileName}!`);
        }
    } catch (error) {
        console.log(error);
    }
}
start()
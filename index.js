const axios = require("axios").default
const cheerio = require("cheerio")
const fs = require("fs")

// This script is extended/modified version of LucasGenovese's Steam-API (https://github.com/LucasGenovese/Steam-API)
// Enter if you want to fetch only games that you dont own in library
const apiKey = ""
// Copy & paste the Cookie header in one of the requests to steam (f12 or ctrl + shift + I > network > any request)
const cookie = ""
// How many games to fetch?
const fetchNgames = 1000;
// Game list size per request
const fetchNgamesStep = 100;
// Wait `filterSleep` seconds every ... filtering.
const filterSleepEvery = 20
// Wait .... seconds every `filterSleepEvery` filtering.
const filterSleep = 5
// The fee rate (must be substracted from 100, so if the fee is %18 so you should type 0.82)
const fee = 0.82;
// Get cards' profit bigger than ...
const cardProfitThreshold = 0.0
// Get cards' "min", "avg" or "max" profits bigger than "cardProfitThreshold"
const cardProfitThresholdVariable = "avg"
// Example: if cards' "min" (cardProfitThresholdVariable) profit >= 0.0 (cardProfitThreshold), then  get this game!,
// Get cards' quantity bigger than ...
const cardQuantityThreshold = 25
// Recommend cards' that difference between some profits are bigger than ...
const recommendDiffThreshold = 0.40
// Recommend cards' that difference between some profits are bigger than `recommendDiffThreshold` for ... times
const recommendDiffThresholdCount = 3
// Comment cards' that difference between "min, avg, max" profits are lower than... (tags game as RISKY)
// (if bigger than `recommendMAMThreshold` it means too much RISK)
const recommendMAMThreshold = 1.01;
// Whether it include only profitable games or not?
const recommendOnlyProfitable = false;
// It is for calculating more precise "avarage" profit & enables "recommending", if card drop count <= `cardPermutationThreshold`
// it will permutate possible card drops and calculate every single profits
const cardPermutationThreshold = 4
// The file that will results be saved 
const fileName = "results.json";

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
        dynamic_data: "",
        sort_by: "Price_ASC",
        snr: "1_7_7_230_7",
        hidef2p: 1,
        maxprice: 10,
        category1: 998,
        category2: 29,
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
    $('.col.search_price.discounted.responsive_secondrow').each(function (i, element) {
        let str = $([...$(this).contents()]
            .find(e => e.type === "text" && $(e).text().trim()))
            .text()
            .trim();
        let match = /\d+(,\d+)?/.exec(str);
        let price = Number(match[0].replace(',', '.'));
        priceList.push(price);
    });

    $('.search_result_row.ds_collapse_flag').each(function (i, element) {
        let gameId = $(this).find('img').attr('src').split("/")[5].trim(); // grabs game ID from img src and then trims the ID
        idList.push(gameId);
    });

    for (var i = 0; i < priceList.length; i++) {
        priceAndIdList.push({ id: idList[i], price: priceList[i] });
    }
    console.log(`[!] Finished retrieving games, passed '${Math.round((Date.now() - now) / 1000)}' seconds.`)
    return priceAndIdList;
}

async function filterGameByCards(gameId, gamePrice) {
    try {
        const response = await axios.get('https://steamcommunity.com/market/search/render/?query=&start=0&count=30&search_descriptions=0&sort_column=price&sort_dir=asc&appid=753&category_753_Game%5B%5D=tag_app_' + gameId + '&category_753_cardborder%5B%5D=tag_cardborder_0&category_753_item_class%5B%5D=tag_item_class_2', {
            'headers': {
                'Cookie': cookie
            }
        })
        let tradingCardQtyList = []
        let tradingCardNameList = []
        let tradingCardPricesClean = []

        const $ = cheerio.load(response.data?.results_html || "");

        let tradingCardPrice = $('span > span.normal_price').text();
        // Get item quantities
        $('span.market_listing_num_listings_qty').each(function (i, element) {
            let str = $([...$(this).contents()]
                .find(e => e.type === "text" && $(e).text().trim()))
                .text()
                .trim();
            let qty = Number(str.replace(',', '.'));
            tradingCardQtyList.push(qty);
        });
        // Get item names
        $('span.market_listing_item_name').each(function (i, element) {
            let str = $([...$(this).contents()]
                .find(e => e.type === "text" && $(e).text().trim()))
                .text()
                .trim();
            tradingCardNameList.push(str);
        });
        // Get card ammount
        let tradingCardAmmount = parseFloat(response.data.total_count);
        // Get item price
        if (tradingCardPrice) {
            // Validates if tradingCardPrice is not undefined
            let tradingCardPrices = tradingCardPrice.match(/(\d+(,\d+))+/g);
            for (var i = 0; i < tradingCardAmmount; i++) {
                tradingCardPricesClean.push(parseFloat(tradingCardPrices[i].replace(",", ".")))
            }
        }
        // Merge item price, quantity and name into one object and append it to a list
        let tradingCards = []
        for (var i = 0; i < tradingCardPricesClean.length; i++) {
            tradingCards.push({ price: tradingCardPricesClean[i], qty: tradingCardQtyList[i], name: tradingCardNameList[i] })
        }

        // Gets and trims the game name
        let gameName = $('.market_listing_game_name').first().text().trim();
        let gameNameTrimmed = gameName.split(' ').slice(0, -2).join(' ');

        let possibleCards = Math.round(tradingCardAmmount / 2);

        // Calculates profits
        let profits = {}
        profits["min"] = parseFloat(((tradingCardPricesClean[0] * possibleCards * fee) - gamePrice).toFixed(2));
        profits["avg"] = parseFloat((((tradingCardPricesClean[(tradingCardPricesClean.length - (tradingCardPricesClean.length % 2)) / 2] + tradingCardPricesClean[Math.round(tradingCardPricesClean.length / 2) - 1]) / 2) * fee * possibleCards - gamePrice).toFixed(2));
        profits["max"] = parseFloat(((tradingCardPricesClean[tradingCardPricesClean.length - 1] * possibleCards * fee) - gamePrice).toFixed(2));

        let possibleProfits = []
        let profitDifferences = []
        let profitDifferencesCount = 0;
        let comments = [];
        // Check for permutations of card prices if possible card count is lower than `cardPermutationThreshold`, because higher card count means higher cpu & ram usage
        if (possibleCards <= cardPermutationThreshold) {
            let permOfCardPrices = permutation(tradingCards, possibleCards)
            for (var perm of permOfCardPrices) {
                let total = 0;
                for (var x of perm) {
                    total += x.qty > cardQuantityThreshold ? x.price : -x.price;
                }
                possibleProfits.push(total * fee - gamePrice)
            }
            // Sort array lower to highest
            possibleProfits = possibleProfits.sort(function (a, b) { return a - b; });
            // Is it a good investment? It checks if the difference between profits are bigger than `recommendDiffThreshold` for `recommendDiffThresholdCount` times.
            profitDifferences = possibleProfits.slice(1).map(function (n, i) { return n - possibleProfits[i]; });
            for (var pd of profitDifferences) {
                if (pd >= recommendDiffThreshold) {
                    profitDifferencesCount += 1
                }
            }
            // Change avarage for more accurate price.
            profits["avg"] = parseFloat(((possibleProfits[(possibleProfits.length - (possibleProfits.length % 2)) / 2] + possibleProfits[Math.round(possibleProfits.length / 2) - 1]) / 2).toFixed(2));
            // Change recommendation state
            let profits3Diff = Object.values(profits).slice(1).map(function (n, i) { return n - Object.values(profits)[i]; });
            if (profitDifferencesCount >= recommendDiffThresholdCount) comments.push("RCMD")
            if (profits3Diff.some(x => x >= recommendMAMThreshold) && possibleProfits.some(x => x < 0)) comments.push("RISK")
            if (possibleProfits.some(x => x < 0)) comments.push("LOSS")
        }
        // Filter game
        if (profits[cardProfitThresholdVariable] >= cardProfitThreshold) {
            if (recommendOnlyProfitable && profits["min"] < 0) {
                return true;
            }
            return {
                name: gameNameTrimmed,
                price: gamePrice,
                dropCount: possibleCards,
                cardPrices: tradingCardPricesClean,
                cards: tradingCards,
                profits: profits,
                possibleProfits: possibleProfits,
                comments: comments.join(" "),
                url: 'https://store.steampowered.com/app/' + gameId,
                id: parseInt(gameId)
            };
        } else {
            return true;
        }

    } catch {
        return false;
    }
}

async function getGames() {
    // Create price & game ID list
    var priceListAndIdList = await getGameList();

    let fullList = [];
    let errors = [];

    let ETA = Math.floor(priceListAndIdList.length / filterSleepEvery) * filterSleep
    ETA += priceListAndIdList.length * 0.54
    ETA += 27 // It might give 2 errors at least?
    const now = Date.now();
    console.log(`[!] Filtering starting, estimated time of filtering is '${Math.round(ETA)}' seconds. `)
    for (let i = 0; i < priceListAndIdList.length; i++) {
        // Every filterSleepEvery requests waits filterSleep seconds so it wont block me for attempting too much
        if (i % filterSleepEvery === 0 && i != 0) {
            await sleep(filterSleep * 1000);
        }
        // Retrieves and makes list of profitable games
        let latestNode = await filterGameByCards(priceListAndIdList[i].id, priceListAndIdList[i].price);
        if (latestNode) {
            if (latestNode !== true) fullList.push(latestNode);
            console.log(`${i + 1}/${priceListAndIdList.length} - Game filtered successfully!`)
        } else {
            console.log(`${i + 1}/${priceListAndIdList.length} - Game couldn't be fetched, waiting 5 seconds!`)
            errors.push(i)
            await sleep(5000);
        }
    }
    if (errors.length > 0) {
        console.log(`${errors.length} games couldn't be fetched, they will be filtered again. With 1 seconds intervals.`)
        for (var i of errors) {
            await sleep(1000);
            let latestNode = await filterGameByCards(priceListAndIdList[i].id, priceListAndIdList[i].price);
            if (latestNode) {
                if (latestNode !== true) fullList.push(latestNode);
                console.log(`${i + 1}/${priceListAndIdList.length} - Game filtered successfully (RETRY)!`)
                errors.splice(errors.indexOf(i), 1)
            } else {
                console.log(`${i + 1}/${priceListAndIdList.length} - Game couldn't be fetched, waiting 7.5 seconds! (RETRY)`)
                await sleep(7500);
            }
        }
    }
    console.log(`[!] Finished filtering games, passed '${Math.round((Date.now() - now) / 1000)}' seconds.`)
    return fullList;
}
async function start() {
    try {
        var finalList;
        if (!logResults && !writeResults) throw new Error("Please, turn on at least one result option. (logResults or writeResults)");
        const date = new Date();
        var ms = date.getTime()
        var hours = date.getHours();
        var minutes = "0" + date.getMinutes();
        var seconds = "0" + date.getSeconds();
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        const formattedTime = `${month}/${day}/${year} ` + hours + ':' + minutes.slice(-2) + ':' + seconds.slice(-2);
        if (apiKey != "" && cookie != "") {
            console.log("API KEY and COOKIE found!")
            console.log(`Retrieving user library... (${formattedTime})`);
            var gameIDList = await getUserLibrary(cookie.match(/(^|)steamLoginSecure=([^;]+)/g)[0].replace("%7C", "|").split("=")[1].split('|')[0]);
            finalList = await getGames();
            console.log(`Successfully retrieved user library!`);
            finalList = finalList.filter(function (val) {
                return gameIDList.indexOf(val.id) === -1;
            });
            if (finalList.length == 0) {
                throw new Error('Already have all games in library.');
            }
        } else {
            console.log(`No ${apiKey == "" && cookie != "" ? "API KEY" : (apiKey != "" && cookie == "" ? "COOKIE" : "API KEY and COOKIE")} found, bypassing user library check`)
            console.log(`Retrieving game list... (${formattedTime})`);
            finalList = await getGames();
            console.log("Successfully retrieved game list!");
            console.log(`It took '${Math.round(Math.round((Date.now() - ms) / 1000))}' seconds.`);
            console.log("'RCMD' for RECOMMENDED games may be profitable.");
            console.log("'RISK' for RISKY games may not be profitable if you have bad luck.")
            console.log("'LOSS' for games that might get you in loss.")
            if (finalList.length == 0) {
                throw new Error('No games found!');
            }
        }
        if (logResults) {
            let rows = []
            for (obj of finalList) {
                rows.push({ name: obj.name, price: obj.price, dropCount: obj.dropCount, minProfit: obj.profits.min, avgProfit: obj.profits.avg, maxProfit: obj.profits.max, comments: obj.comments, id: obj.id })
            }
            console.table(rows)
        }
        if (writeResults) {
            console.log(`Process completed, writing results to ${fileName}`);
            fs.writeFileSync(fileName, JSON.stringify(finalList, null, 4))
            console.log(`Results written to ${fileName}!`);
        }
    } catch (error) {
        console.log(error);
    }
}
start()
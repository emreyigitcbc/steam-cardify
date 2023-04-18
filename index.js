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
// The fee rate (must be substracted from 100, so if the fee is %18 so you should type 0.82)
const fee = 0.82;
// Get cards' profit bigger than ...
const cardThreshold = 0.0
// Get cards' "min", "avg" or "max" profits bigger than "cardThreshold"
const cardThresholdVariable = "min"
// Example: if cards' "min" (cardThresholdVariable) profit >= 0.0 (cardThreshold), then  get this game!
// The file that will results be saved 
const fileName = "results.json";
// Do you want to log the result to console?
const logResults = true;
// Do you want to write results to file?
const writeResults = true;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    for (var i = 0; i < Math.round(fetchNgames / fetchNgamesStep); i++) {
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
    return priceAndIdList;
}

async function filterGameByCards(gameId, gamePrice) {
    const response = await axios.get('https://steamcommunity.com/market/search/render/?query=&start=0&count=30&search_descriptions=0&sort_column=price&sort_dir=asc&appid=753&category_753_Game%5B%5D=tag_app_' + gameId + '&category_753_cardborder%5B%5D=tag_cardborder_0&category_753_item_class%5B%5D=tag_item_class_2', {
        'headers': {
            'Cookie': cookie
        }
    })    // gets price, trims it and parses it to float
    const $ = cheerio.load(response.data?.results_html || "");
    let tradingCardPrice = $('.normal_price').text().trim();
    let tradingCardPricesClean = []
    let tradingCardAmmount = parseFloat(response.data.total_count);
    if (tradingCardPrice) { // validates if tradingCardPrice is not undefined
        let tradingCardPrices = tradingCardPrice.match(/(\d+(,\d{1,2}))+/g);
        for (var i = 1; i < tradingCardAmmount + 1; i++) {
            tradingCardPricesClean.push(parseFloat(tradingCardPrices[3 * i - 1].replace(",", ".")))
        }
    }

    // Gets and trims the game name
    let gameName = $('.market_listing_game_name').first().text().trim();
    let gameNameTrimmed = gameName.split(' ').slice(0, -2).join(' ');

    // Calculates profits
    let profits = {}
    let possibleCards = Math.round(tradingCardAmmount / 2);
    profits["min"] = parseFloat(((tradingCardPricesClean[0] * possibleCards * fee) - gamePrice).toFixed(2));
    profits["avg"] = parseFloat((((tradingCardPricesClean[(tradingCardPricesClean.length - (tradingCardPricesClean.length % 2)) / 2] + tradingCardPricesClean[Math.round(tradingCardPricesClean.length / 2) - 1])/2) * fee * possibleCards - gamePrice).toFixed(2));
    profits["max"] = parseFloat(((tradingCardPricesClean[tradingCardPricesClean.length - 1] * possibleCards * fee) - gamePrice).toFixed(2));

    // shows only profitable games
    if (profits[cardThresholdVariable] >= cardThreshold) {
        return {
            name: gameNameTrimmed,
            price: gamePrice,
            cardCount: possibleCards,
            cardPrices: tradingCardPricesClean,
            profits: profits,
            url: 'https://store.steampowered.com/app/' + gameId,
            id: parseInt(gameId)
        };
    }
}

async function getGames() {
    // Create price & game ID list
    var priceListAndIdList = await getGameList();

    let fullList = [];

    for (let i = 0; i < priceListAndIdList.length; i++) {
        // every 20 requests waits 5 seconds so it wont block me for attempting too much
        if (i % 20 === 0 && i != 0) {
            await sleep(5000);
        }
        // retrieves and makes list of profitable games
        let latestNode = await filterGameByCards(priceListAndIdList[i].id, priceListAndIdList[i].price);
        if (latestNode) {
            fullList.push(latestNode);
        }
        console.log(`${i + 1}/${priceListAndIdList.length} - Game filtered successfully!`)
    }
    return fullList;
}
async function start() {
    try {
        var finalList;
        if (!logResults && !writeResults) throw new Error("Please, turn on at least one result option. (logResults or writeResults)");
        if (apiKey != "" && cookie != "") {
            console.log("API KEY and COOKIE found!")
            console.log("Retrieving user library...");
            var gameIDList = await getUserLibrary(cookie.match(/(^|)steamLoginSecure=([^;]+)/g)[0].replace("%7C", "|").split("=")[1].split('|')[0]);
            finalList = await getGames();
            console.log("Successfully retrieved user library!");
            finalList = finalList.filter(function (val) {
                return gameIDList.indexOf(val.id) === -1;
            });
            if (finalList.length == 0) {
                throw new Error('Already have all games in library.');
            }
        } else {
            console.log(`No ${apiKey == "" && cookie != "" ? "API KEY" : (apiKey != "" && cookie == "" ? "COOKIE" : "API KEY and COOKIE")} found, bypassing user library check`)
            console.log("Retrieving game list...");
            finalList = await getGames();
            console.log("Successfully retrieved game list!");
            if (finalList.length == 0) {
                throw new Error('No games found!');
            }
        }
        if (logResults) {
            let rows = []
            for (obj of finalList) {
                rows.push({name: obj.name, price: obj.price, cardCount: obj.cardCount, minProfit: obj.profits.min, avgProfit: obj.profits.avg, maxProfit: obj.profits.max, id: obj.id})
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
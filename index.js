var fs = require('fs');

var data = fs.readFileSync('data.json', 'utf8');
var rules = fs.readFileSync('100_rules.json', 'utf8');
//var rules = fs.readFileSync('10k_rules.json', 'utf8');
/**
 * RuleRunner
 * @type {{rules: {}, data: string, entryPoints: Array, executedRules: {}, executedRuleTexts: Array, init: ruleRunner.init, prepareRules: ruleRunner.prepareRules, runRule: ruleRunner.runRule, finishExecution: ruleRunner.finishExecution}}
 */
var ruleRunner = {
    rulesObj: {},
    incomingDataObj: {},
    entryPoint: null,
    executedRules: {},
    executedRuleTexts: [],
    init: function(rules, incomingData){
        this.incomingDataObj = validationHelper.validateData(incomingData);
        var validatedRules = validationHelper.validateData(rules, true);
        var ruleSettings = this.processRules(validatedRules);
        this.rulesObj = ruleSettings.rulesObj;
        /**
         * As it seems to be a decision tree, entry point should be only one
         */
        if (validationHelper.hasLength(ruleSettings.entryPoints, 1)) {
            this.entryPoint = ruleSettings.entryPoints[0];
        }
    },
    /**
     *
     * @returns {ruleRunner.incomingDataObj|{}}
     */
    getIncomingDataObj: function(){
        return this.incomingDataObj;
    },
    /**
     *
     * @returns {ruleRunner.rulesObj|{}}
     */
    getRulesObj: function(){
        return this.rulesObj;
    },
    /**
     *
     * @returns mixed
     */
    getEntryPoint: function(){
        return this.entryPoint;
    },
    /**
     * to minimize loops over rules array (complexity), this method creates all needed
     * additional structures of data to proceed. To keep all structures only local
     * I decided to combine it with searching of entry point.
     * @param rules
     * @returns {{rulesObj: {}, entryPoints: Array}}
     */
    processRules: function(rules){
        var oIds = [], tfIds = [], rulesObj = {};
        rules.forEach(function(rule){
            oIds.push(rule.id);
            tfIds.push(rule.true_id);
            tfIds.push(rule.false_id);
            rulesObj[rule.id] = rule;
        }.bind(this));
        /**
         * Entry point should be a rule, on which no other rule is pointing
         * its ID should be on the list of unique ids, but not on list of
         * true or false ids.
         */
        var entryPoints = oIds.filter(function(id){
            return tfIds.indexOf(id) < 0;
        });
        oIds = tfIds = null;
        return {rulesObj: rulesObj, entryPoints: entryPoints};
    },
    runRule: function(rule){
        var ruleAlreadyExecuted;
        var funcBody = (rule.rule.indexOf('function') === 0) ? '{return ' + rule.rule + '(data)}' : rule.rule;
        var result = (new Function('data', funcBody))(this.data);
        this.executedRules[rule.id] = result;
        if (result === true) {
            this.nextRuleExecution(result, rule);
        } else if (result === false) {
            this.nextRuleExecution(result, rule);
        } else {
            throw Error('Result not recognised, game over!');
        }
    },
    nextRuleExecution: function(result, rule){
        this.executedRuleTexts.push(
            {
                result: result,
                text: 'Rule ' + rule.id + ((result) ? ' passed.' : ' failed.')
            }
        );
        var idPropertyName = result.toString() + '_id';
        if (rule[idPropertyName] === null) {
            return this.finishExecution(this.executedRuleTexts);
        }
        var ruleAlreadyExecuted = this.executedRules.hasOwnProperty(rule[idPropertyName].toString());
        if (this.getRulesObj()[rule[idPropertyName]] && !ruleAlreadyExecuted) {
            this.runRule(this.getRulesObj()[rule[idPropertyName]]);
        } else if (ruleAlreadyExecuted){
            throw Error('The rule with id: ' + rule[idPropertyName] + ' cannot be executed again.');
        } else {
            throw Error('Rule with id: ' + rule[idPropertyName] + 'does not exist. Is defined in rule ' + rule.id + '.');
        }
    },
    finishExecution: function(result){
        var colors = {};
        colors['false'] = '\033[31m';
        colors['true'] = '\033[32m';
        colors['reset'] = '\033[0m';
        console.log('Result:');
        result.forEach(function(textObj, index){
            console.log(colors[textObj.result.toString()], index+1, textObj.text, colors['reset']);
        });
        console.log('End.');
        return false;
    }
};

var validationHelper = {
    /**
     * Method for basic validation of data which come from database, API, whatever
     * as a JSON string
     * @param originalData string
     * @param hasLength mixed
     * @returns mixed
     */
    validateData: function(originalData, hasLength){
        if (typeof originalData !== "string") {
            throw Error('Wrong format of data definition!');
        }
        var dataObject;
        try {
            dataObject = JSON.parse(originalData);
        } catch(err) {
            throw Error('The data passed to validation are not valid! ' + err);
        }
        if (hasLength) {
            this.hasLength(dataObject, hasLength);
        }
        return dataObject;
    },
    /**
     * Helper validation method, which checks if passed argument is an array and has
     * defined number of elements or if has more than 0 elements
     * @param arr
     * @param len
     * @returns {boolean}
     */
    hasLength: function(arr, len){
        if (arr instanceof Array) {
            if (len !== true && len >= 0) {
                if (arr.length !== len) {
                    throw Error('Not correct number of elements in passed array!');
                }
                return true;
            } else if (len === true) {
                if (arr.length <= 0) {
                    throw Error('No elements in passed array!');
                }
                return true;
            }
        }
        throw Error('Passed argument expected to be an Array, but is not!');
    }
};

ruleRunner.init(rules, data);
ruleRunner.runRule(ruleRunner.getRulesObj()[ruleRunner.getEntryPoint()]);
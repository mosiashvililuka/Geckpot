const he = require('he'); // Library for decoding HTML entities
const axios = require('axios'); // Library for making HTTP requests
const express = require('express'); // Web framework for Node.js
const bodyParser = require('body-parser'); // Middleware to parse request bodies
const cors = require('cors'); // Middleware for Cross-Origin Resource Sharing
const app = express();
const port = 3000;

// Use middleware
app.use(cors());
app.use(bodyParser.json());

// Game state variables
let round, money; // Current round and user's money
let questionSet; // Set of questions for the game
let easyQuestions = [], mediumQuestions = [], hardQuestions = []; // Categorized questions
const prizePerRound = [0, 100, 350, 600, 1000, 2000, 5000, 10000, 25000, 50000, 75000, 100000, 200000, 300000, 500000, 1000000]; // Prize amounts
let hints; // Hints availability
let time; // Remaining time for the round

// Function to decode HTML entities in strings
const reviseStr = (str) => {
    return he.decode(str);  // This will decode all HTML entities, like &ouml;, &uuml;, etc.
};

// Function to restart the game and fetch new questions
const restartGame = async () => {
    try {
        // Fetch questions from the Open Trivia Database API
        const response = await axios.get(`https://opentdb.com/api.php?amount=50&category=22&type=multiple`);
        const questionsData = response.data.results;
        questionsData.sort(() => Math.random() - 0.5); // Shuffle the questions

        // Reset categorized questions
        easyQuestions = [];
        mediumQuestions = [];
        hardQuestions = [];

        // Process fetched questions
        questionsData.map(item => {
            const question = {
                question: reviseStr(item.question), // Decode the question
                difficulty: item.difficulty, // Get difficulty level
                answer: reviseStr(item.correct_answer), // Decode the correct answer
                choices: item.incorrect_answers // Incorrect choices
            }

            // Decode incorrect answers
            for(let i = 0; i < question.choices.length; i++) question.choices[i] = reviseStr(question.choices[i]);

            question.choices.push(question.answer); // Add correct answer to choices
            question.choices.sort(() => Math.random() - 0.5); // Shuffle the choices

            // Categorize questions based on difficulty
            if (item.difficulty === "easy") easyQuestions.push(question);
            if (item.difficulty === "medium") mediumQuestions.push(question);
            if (item.difficulty === "hard") hardQuestions.push(question);
        });

        // Reset game state
        round = 1;
        money = 0;
        questionSet = [];
        hints = {
            twoChoices: true,
            hint: true,
            skip: true
        }

        // Make the question set
        for(let i = 0; i < 5; i++) questionSet.push(easyQuestions[i]);
        for(let i = 0; i < 5; i++) questionSet.push(mediumQuestions[i]);
        for(let i = 0; i < 5; i++) questionSet.push(hardQuestions[i]);
    } catch (error) {
        console.log("Error extracting questions", error); // Log any errors
    }
}

// Start the game by fetching questions
restartGame();

// Endpoint to get hints
app.get('/hints', (req, res) => {
    res.json({hints: hints}); // Send current hint availability
});

// Endpoint to use a hint
app.post('/hints/use', (req, res) => {
    let question = questionSet[round - 1]; // Get the current question
    const hintType = req.body.type; // Get the type of hint requested

    // Remove two incorrect answer choices
    if (hintType === 'twoChoices') {
        if (hints.twoChoices){
            while (question.choices.length > 2) {
                let randInd = Math.floor(Math.random() * question.choices.length); // Get a random choice
                if (question.choices[randInd] !== question.answer) { // Ensure it is not the correct answer.
                    question.choices.splice(randInd, 1); // Remove a wrong choice
                }
            }
        }

        hints.twoChoices = false; // Mark the hint as used
        res.json({choices: question.choices, hints: hints}); // Send updated choices and hints
    }

    // Handle skip hint
    if (hintType === 'skip') {
        if (hints.skip) {
            money += prizePerRound[round] - prizePerRound[round - 1]; // Update money
            round++; // Move to the next round
        }

        hints.skip = false; // Mark the hint as used
        res.json({answer: question.answer, hints: hints}); // Send the correct answer and updated hints
    }
});

// Welcome endpoint
app.get('/', (req, res) => {
    res.send('Welcome to the Geography Quiz API');
});

// Endpoint to get the current question
app.get('/questions', (req, res) => {
    const question = questionSet[round - 1]; // Get the current question
    res.json({
        question: question.question,
        choices: question.choices,
    });
});

// Endpoint to submit an answer
app.post('/answer', (req, res) => {
    const question = questionSet[round - 1]; // Get the current question
    const userAnswer = req.body.userAnswer; // Get the user's answer

    // Check if the answer is correct
    if (userAnswer === question.answer) {
        if (round === questionSet.length) {
            res.json({ verdict: "jackpot", message: `Congratulations!\nYou are a millionaire!` });
            restartGame(); // Restart the game if the last question is answered correctly
        }

        res.json({ verdict: "correct", message: "Correct!" }); // Respond with correct message
        money += prizePerRound[round] - prizePerRound[round - 1]; // Update money
        round++; // Move to the next round
    } else {
        // Respond with wrong answer message
        res.json({ verdict: "wrong",
            message: `Wrong!\nThe correct answer is ${question.answer}\n\nGame Over :(\nYou won $${money}`});
        restartGame(); // Restart the game
    }
});

// Endpoint to initialize the timer
app.post('/timer/initialize', (req, res) => {
    if (round <= 5) time = 15; // Set time based on the round
    else if (round <= 10) time = 20;
    else time = 25;

    res.json({time: time}); // Send the initial time
});

// Endpoint to track time passing
app.post('/timer/second_passed', (req, res) => {
    time--; // Decrease the time
    if (time <= 0) {
        res.json({ time: time,
            message: `Time elapsed\nThe correct answer is ${questionSet[round - 1].answer}\n\nGame Over :(\nYou won $${money}`});
        restartGame(); // Restart the game if time is up
    } else {
        res.json({time: time}); // Send the remaining time
    }
});

// Endpoint to get current score data
app.get('/score', (req, res) => {
    res.json({round: round, money: money, prize: prizePerRound[round] - prizePerRound[round - 1]}); // Send current round, money, and prize data
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

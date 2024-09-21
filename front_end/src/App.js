import './App.css';
import React, { useState, useEffect } from "react";
import axios from "axios";

// Define the port for the backend server
const port = 3000;

// Initialize a counter to differentiate the instances of timer
let idCnt = 0;

// Load sound effects
const correctSound = new Audio("/correct.mp3");
const wrongSound = new Audio("/wrong.mp3");
const jackpotSound = new Audio("/jackpot.mp3");
const clockSound = new Audio("/clock-tick.mp3");
const timeIsUpSound = new Audio("/time-is-up.mp3");

function App() {
  // State variables to manage game state
  const [question, setQuestion] = useState(""); // Current question
  const [choices, setChoices] = useState([]); // Answer choices
  const [userAnswer, setUserAnswer] = useState(""); // User's selected answer
  const [round, setRound] = useState(1); // Current round
  const [money, setMoney] = useState(0); // User's accumulated money
  const [prize, setPrize] = useState(0); // Current prize for the round
  const [time, setTime] = useState(0); // Remaining time for the round
  const [hints, setHints] = useState({ // Hints availability
    twoChoices: true,
    hint: true,
    skip: true
  });

  // Fetch a new question when the component mounts
  useEffect(() => {
    fetchQuestion();
  }, []);

  // Timer function to track time for the current question
  const timer = async (id) => {
    if (id !== idCnt) return; // Ensure the timer is for the current game instance

    // Get the remaining time from the server
    const response = await axios.post(`http://localhost:${port}/timer/second_passed`);
    const currTime = response.data.time;
    setTime(currTime); // Update the time state

    // Check if the time is up
    if (currTime <= 0) {
      idCnt++; // Increment the counter for the next question
      clockSound.pause();
      clockSound.currentTime = 0;

      // Play the time is up sound and alert the user
      await timeIsUpSound.play();
      alert(response.data.message);

      fetchQuestion(); // Fetch the next question
    }

    // Play clock sound when time reaches 5 seconds
    if (currTime === 5) {
      await clockSound.play();
    }

    setTimeout(() => timer(id), 1000); // Schedule the next tick
  }

  // Fetch a new trivia question from the server
  const fetchQuestion = async () => {
    idCnt++; // Increment the ID for timer
    setUserAnswer(''); // Reset the user answer
    try {
      let response = await axios.get(`http://localhost:${port}/questions`);
      setQuestion(response.data.question); // Update the question state
      setChoices(response.data.choices); // Update the choices state

      // Fetch score data for the current round
      response = await axios.get(`http://localhost:${port}/score`);
      setRound(response.data.round);
      setMoney(response.data.money);
      setPrize(response.data.prize);

      // Initialize the timer
      response = await axios.post(`http://localhost:${port}/timer/initialize`);
      setTime(response.data.time);

      // Fetch hint availability
      response = await axios.get(`http://localhost:${port}/hints`);
      setHints(response.data.hints);
    } catch (error) {
      console.error("Error updating question", error); // Log any errors
    }

    setTimeout(() => timer(idCnt), 1000); // Start the timer for the new question
  }

  // Submit the user's answer and handle feedback
  const submitAnswer = async () => {
    if (!userAnswer) return; // Do nothing if no answer is selected

    try {
      const response = await axios.post(`http://localhost:${port}/answer`, {userAnswer: userAnswer});

      // Handle the outcome of the answer
      if (response.data.verdict === "correct") {
        clockSound.pause();
        clockSound.currentTime = 0;
        await correctSound.play(); // Play correct sound
      } else if (response.data.verdict === "jackpot") {
        clockSound.pause();
        clockSound.currentTime = 0;
        await jackpotSound.play(); // Play jackpot sound
      } else {
        clockSound.pause();
        clockSound.currentTime = 0;
        await wrongSound.play(); // Play wrong answer sound
        alert(response.data.message); // Alert the user
      }

      fetchQuestion(); // Fetch the next question
    } catch (error) {
      console.error("Error submitting answer", error); // Log any errors
    }
  }

  // Get a hint based on the type requested
  const getHint = async (type) => {
    try {
      const response = await axios.post(`http://localhost:${port}/hints/use`, {type: type});
      setHints(response.data.hints); // Update hint availability

      // Handle the hint types
      if (type === "twoChoices") {
        setChoices(response.data.choices); // Update choices with two options
      } else if (type === "skip") {
        alert(response.data.answer); // Show the answer if skipped
        fetchQuestion(); // Fetch the next question
      }
    } catch (error) {
      console.error("Error omitting two choices", error); // Log any errors
    }
  }

  // Handle answer input changes
  const handleAnswerChange = (click) => {
    setUserAnswer(answer => click.target.value); // Update user's answer
  }

  return (
      <div className="container">
        <h1 className="text-center mt-4">Gecktpot</h1>
        <div className="card mt-4">
          <div className="card-body">
            <h5 className="card-title">Round {round}:</h5>
            {question && (
                <div>
                  <p>Time: {time}s</p>
                  <p>{question} (${prize})</p>
                  {choices.map((choice, index) => (
                      <div className="form-check" key={index}>
                        <input
                            className="form-check-input"
                            type="radio"
                            id={`choice${index}`}
                            name="choice"
                            value={choice}
                            onChange={handleAnswerChange}
                            checked={userAnswer === choice}
                        />
                        <label className="form-check-label" htmlFor={`choice${index}`}>
                          {choice}
                        </label>
                      </div>
                  ))}
                  <button className="btn btn-primary mt-3" onClick={submitAnswer}>Submit Answer</button>
                  <div className="mt-3">
                    {hints.twoChoices && (
                        <button className="btn btn-warning" onClick={() => getHint("twoChoices")}>Leave Two Choices</button>
                    )}
                    {hints.skip && (
                        <button className="btn btn-secondary" onClick={() => getHint("skip")}>Skip The Question</button>
                    )}
                  </div>
                  <p className="mt-3">Your Cash: ${money}</p>
                </div>
            )}
          </div>
        </div>
      </div>
  );
}

export default App;

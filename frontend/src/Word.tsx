import React from 'react';
import Tile from './Tile';
import './Word.css';
import {Guess, GuessResult, LetterState} from "./services/interfaces";


export type WordProps = {
  guess: GuessResult;
  opponent: boolean;
}

function Word(props: WordProps) {
  return (
      <div className="word">
          { props.guess.letter_results.map((state, idx: number) =>
          <td key={idx}><Tile letter={props.guess.guess_word[idx]} letterState={state} key={idx} opponent={props.opponent}/></td>
          ) }
      </div>
  );
}

export default Word;

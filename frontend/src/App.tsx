import React, {Component} from 'react';
import './App.css';
import WordTable from "./WordTable";
import {ClientState, GameStatus, Player} from "./services/interfaces"
import Create from "./Create";
import GameService from "./services/GameService";
import Waiting from "./Waiting";
import InvalidWord from "./InvalidWord";
import PickWord from "./PickWord";
import EndGame from "./EndGame";

interface AppState {
  gameId?: string;
  gameStatus?: GameStatus;
  clientState?: ClientState;
  playerInfo?: Player;
  isPlayerOne: boolean;
  waitingOpponent: string;
  invalidWord: boolean;
}

class App extends Component<{}, AppState> {
  private infoPollInterval?: NodeJS.Timer;
  private infoReqCounter: number = 0;

  private statePollInterval?: NodeJS.Timer;
  private stateReqCounter: number = 0;

  constructor(props: {}) {
    super(props);
    this.state = {gameId: undefined, clientState: undefined, isPlayerOne: false, waitingOpponent: "", invalidWord: false}
  }


  componentDidMount() {
  }

  onGameCreate = (name: string) => {
    this.setState({isPlayerOne: true});
    GameService.createGame().then(r => {
      this.onGameJoin(name, r.game_id);
    });
  }

  onGameJoin = (name: string, gameId: string) => {
    GameService.joinGame(gameId, name).then(r => {
      this.setState({gameId, playerInfo: r});
      this.infoPollInterval = setInterval(this.pollInfoUntilReady, 1000);
      this.setState({waitingOpponent: `Game Code: ${this.state.gameId}`});
    })
  }

  onWordPicked = (word: string) => {
    GameService.pickWord(this.state.gameId!, word, this.state.playerInfo?.secret_id!).then(r => {
      if (!r.status.utc_started) {
        this.setState({invalidWord: false});
        this.setState({waitingOpponent: "...opponent is choosing a very secret word."});
        this.infoPollInterval = setInterval(this.pollInfoUntilStarted, 1000);
      } else {
        this.setState({waitingOpponent: "", invalidWord: false});
        this.statePollInterval = setInterval(this.pollClientState, 1000);
      }
      this.setState({gameStatus: r.status});
    }).catch((error) => {this.setState({invalidWord: true});});
  }

  pollInfoUntilReady = () => {
    this.infoReqCounter += 1;
    const reqNumber = this.infoReqCounter;
    GameService.getInfo(this.state.gameId!).then(r => {
      if (reqNumber < this.infoReqCounter) {
        return;
      }
      if (r.status.utc_ready || this.infoReqCounter > 10_000) {
        clearInterval(this.infoPollInterval!);
        this.infoPollInterval = undefined;
        this.setState({waitingOpponent: ""});
      }
      this.setState({gameStatus: r.status});
    })
  }

  pollInfoUntilStarted = () => {
    this.infoReqCounter += 1;
    const reqNumber = this.infoReqCounter;
    GameService.getInfo(this.state.gameId!).then(r => {
      if (reqNumber < this.infoReqCounter) {
        return;
      }
      if (r.status.utc_started || this.infoReqCounter > 10_000) {
        clearInterval(this.infoPollInterval!);
        this.infoPollInterval = undefined;
        if (r.status.utc_started) {
          this.statePollInterval = setInterval(this.pollClientState, 1000);
        }
        this.setState({waitingOpponent: ""});
      }
      this.setState({gameStatus: r.status});
    });
  }

  pollClientState = () => {
    this.stateReqCounter += 1;
    const reqNumber = this.stateReqCounter;
    GameService.getState(this.state.gameId!, this.state.playerInfo!.secret_id).then(r => {
      if (reqNumber < this.stateReqCounter) {
        return;
      }
      if (r.end_state) {
        clearInterval(this.statePollInterval! || this.stateReqCounter > 10_000);
        this.statePollInterval = undefined;
      }
      if (!r.player.pending_guess) {
        this.setState({waitingOpponent: ""});
      }
      this.setState({clientState: r});
    })
  }

  onGuess = (guessWord: string) => {
    this.stateReqCounter += 1;
    GameService.guessWord(this.state.gameId!, guessWord, this.state.playerInfo?.secret_id!).then(r => {
      if (r.end_state) {
        this.setState({invalidWord: false, waitingOpponent: ""});
        clearInterval(this.statePollInterval!);
        this.statePollInterval = undefined;
      }
      this.setState({invalidWord: false});
      this.setState({waitingOpponent: "Waiting for opponent guess..."});
      this.setState({clientState: r});
    }).catch((e) => {this.setState({invalidWord: true})});
  }

  render() {
    return (
      <div className="App">
        <header>
          <h1 className="pt-3">BattleWord</h1>
        </header>
        {this.state.clientState?.end_state && <EndGame endState={this.state.clientState?.end_state}/>}
        {this.state.invalidWord && <InvalidWord />}
        {!this.state.gameId && <Create onCreate={this.onGameCreate} onJoin={this.onGameJoin}/>}
        {!!this.state.waitingOpponent && <Waiting bodyText={this.state.waitingOpponent}/>}
        {this.state.gameId && this.state.gameStatus?.utc_ready && !this.state.gameStatus?.utc_started && !this.state.waitingOpponent &&
          <PickWord onWordPicked={this.onWordPicked}/>}
        {this.state.clientState &&
          <WordTable guesses={this.state.clientState?.guesses!} isPlayerOne={this.state.isPlayerOne}
                     playerName={this.state.playerInfo!.name} onGuess={this.onGuess}
                     opponentSubmittedGuess={this.state.clientState.opponent_submitted_guess}/>}
      </div>
    );
  }
}

export default App;

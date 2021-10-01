import {
    clearSSNAttemptsDataForAccount, getSSNAttemptsDataForAccount,
    updateSSNAttemptsDataForAccount
} from './database-queries';

const MAX_CONSECUTIVE_ATTEMPTS = parseInt( process.env.MAX_CONSECUTIVE_ATTEMPTS_WITHIN_TIMESPAN || 1000 );
const WAIT_BETWEEN_MAX_CONSECUTIVE_ATTEMPTS = parseInt( process.env.MAX_CONSECUTIVE_ATTEMPTS_TIMESPAN || 30000 );

export async function hadTooManyAttemptsWithinTimespan( { account }){
  const attemptsData = await getSSNAttemptsDataForAccount( account );
  if(!attemptsData) return false;
  else{
    if( attemptsData.attempts >= MAX_CONSECUTIVE_ATTEMPTS
        && (new Date() - attemptsData.lastAttemptAt) <= WAIT_BETWEEN_MAX_CONSECUTIVE_ATTEMPTS){
      return true;
    }
    else return false;
  }
}

export async function manageAttemptsData( { account } ){
  await clearAttemptsDataIfPossible( account  );
  await incrementAttemptsData( account  );
}

export async function clearAttemptsDataIfPossible(  account ){
  const attemptsData = await getSSNAttemptsDataForAccount( account );
  if(attemptsData){
    if( (new Date() - attemptsData.lastAttemptAt) > WAIT_BETWEEN_MAX_CONSECUTIVE_ATTEMPTS ){
      await clearSSNAttemptsDataForAccount( account );
    }
  }
}

export async function incrementAttemptsData( account ){
  const data = await getSSNAttemptsDataForAccount( account );
  const incrementedAttempt = ( data && data.attempts || 0 ) + 1;
  updateSSNAttemptsDataForAccount( { account, attempts : incrementedAttempt, lastAttemptAt: new Date() });
}

import { getSSNAttemptsDataForAccount,
         updateSSNAttemptsDataForAccount,
         clearSSNAttemptsDataForAccount } from './database-queries';

const MAX_CONSECUTIVE_ATTEMPTS = parseInt( process.env.MAX_CONSECUTIVE_ATTEMPTS_WITHIN_TIMESPAN || 1000 );
const WAIT_BETWEEN_MAX_CONSECUTIVE_ATTEMPTS = parseInt( process.env.MAX_CONSECUTIVE_ATTEMPTS_TIMESPAN || 30000 );

export async function hadTooManyAttemptsWithinTimespan( { vendor, vendorKey } ){
  const attemptsData = await getSSNAttemptsDataForAccount( { vendor, vendorKey } );
  if(!attemptsData) return false;
  else{
    if( attemptsData.attempts >= MAX_CONSECUTIVE_ATTEMPTS
        && (new Date() - attemptsData.lastAttemptAt) <= WAIT_BETWEEN_MAX_CONSECUTIVE_ATTEMPTS){
      return true;
    }
    else return false;
  }
}

export async function manageAttemptsData( { vendor, vendorKey } ){
  await clearAttemptsDataIfPossible( { vendor, vendorKey } );
  await incrementAttemptsData( { vendor, vendorKey } );
}

export async function clearAttemptsDataIfPossible( { vendor, vendorKey } ){
  const attemptsData = await getSSNAttemptsDataForAccount( { vendor, vendorKey } );
  if(attemptsData){
    if( (new Date() - attemptsData.lastAttemptAt) > WAIT_BETWEEN_MAX_CONSECUTIVE_ATTEMPTS ){
      await clearSSNAttemptsDataForAccount( { vendor, vendorKey } );
    }
  }
}

export async function incrementAttemptsData( { vendor, vendorKey } ){
  const data = await getSSNAttemptsDataForAccount( { vendor, vendorKey } );
  const incrementedAttempt = ( data && data.attempts || 0 ) + 1;
  updateSSNAttemptsDataForAccount( { vendor, vendorKey, attempts : incrementedAttempt, lastAttemptAt: new Date() });
}

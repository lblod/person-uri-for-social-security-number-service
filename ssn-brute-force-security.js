import { getFailedAttemptsDataForAccount, updateFailedAttemptsDataForAccount, clearFailedAttemptsDataForAccount } from './database-queries';

const MAX_CONSECUTIVE_FAILED_ATTEMPTS = parseInt( process.env.MAX_CONSECUTIVE_FAILED_ATTEMPTS || 1000 );
const WAIT_BETWEEN_MAX_CONSECUTIVE_FAILED_ATTEMPTS = parseInt( process.env.WAIT_BETWEEN_MAX_CONSECUTIVE_FAILED_ATTEMPTS || 30000 );

export async function hadTooManyFailedAttemptsWithinTimespan( { vendor, vendorKey } ){
  const failedAttemptsData = await getFailedAttemptsDataForAccount( { vendor, vendorKey } );
  if(!failedAttemptsData) return false;
  else{
    if( failedAttemptsData.attempts >= MAX_CONSECUTIVE_FAILED_ATTEMPTS
        && (new Date() - failedAttemptsData.lastAttemptAt) <= WAIT_BETWEEN_MAX_CONSECUTIVE_FAILED_ATTEMPTS){
      return true;
    }
    else return false;
  }
}

export async function manageFailedAttemptsData( { vendor, vendorKey, lastCallWasSuccess = false } ){
  await clearFailedAttemptsDataIfPossible( { vendor, vendorKey, lastCallWasSuccess } );
  if(!lastCallWasSuccess)
    await incrementFailedAttemptsData( { vendor, vendorKey } );
}

export async function clearFailedAttemptsDataIfPossible( { vendor, vendorKey, lastCallWasSuccess = false } ){
  const failedAttemptsData = await getFailedAttemptsDataForAccount( { vendor, vendorKey } );
  if(failedAttemptsData){
    if((new Date() - failedAttemptsData.lastAttemptAt) > WAIT_BETWEEN_MAX_CONSECUTIVE_FAILED_ATTEMPTS || lastCallWasSuccess){
      await clearFailedAttemptsDataForAccount( { vendor, vendorKey } );
    }
  }
}

export async function incrementFailedAttemptsData( { vendor, vendorKey } ){
  const data = await getFailedAttemptsDataForAccount( { vendor, vendorKey } );
  const incrementedAttempt = ( data && data.attempts || 0 ) + 1;
  updateFailedAttemptsDataForAccount( { vendor, vendorKey, attempts : incrementedAttempt, lastAttemptAt: new Date() });
}

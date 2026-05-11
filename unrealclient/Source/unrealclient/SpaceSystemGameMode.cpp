#include "SpaceSystemGameMode.h"

#include "SpaceSystemLevelActor.h"
#include "SpaceSystemPawn.h"
#include "Engine/World.h"

ASpaceSystemGameMode::ASpaceSystemGameMode()
{
	DefaultPawnClass = ASpaceSystemPawn::StaticClass();
}

void ASpaceSystemGameMode::BeginPlay()
{
	Super::BeginPlay();

	if (UWorld* World = GetWorld())
	{
		World->SpawnActor<ASpaceSystemLevelActor>();
	}
}
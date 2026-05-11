#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "SpaceSystemGameMode.generated.h"

UCLASS()
class UNREALCLIENT_API ASpaceSystemGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ASpaceSystemGameMode();

protected:
	virtual void BeginPlay() override;
};